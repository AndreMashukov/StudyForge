import { logger } from 'firebase-functions/v2';
import { extractVideoId } from './youtube-url-utils';

export interface TranscriptSegment {
  text: string;
  offset: number;
  duration: number;
}

export interface YouTubeTranscriptResult {
  videoId: string;
  title: string;
  markdownContent: string;
  segments: TranscriptSegment[];
}

interface CaptionTrack {
  baseUrl: string;
  languageCode?: string;
  kind?: string;
}

interface InnerTubeClient {
  label: string;
  userAgent: string;
  body: (videoId: string) => Record<string, unknown>;
}

interface ApifyTranscriptJsonSegment {
  start?: number | string;
  end?: number | string;
  duration?: number | string;
  text?: unknown;
}

interface ApifyTranscriptItem {
  error_code?: string;
  error_message?: string;
  language?: string;
  is_ai_generated?: boolean;
  is_auto_generated?: boolean;
  transcript_json?: ApifyTranscriptJsonSegment[];
  transcript_text?: string;
  transcript_llm?: string;
}

const INNER_TUBE_URL = 'https://www.youtube.com/youtubei/v1/player?prettyPrint=false';
const APIFY_TRANSCRIPT_ACTOR_ID = 'codepoetry~youtube-transcript-ai-scraper';

const INNER_TUBE_CLIENTS: InnerTubeClient[] = [
  {
    label: 'ANDROID',
    userAgent: 'com.google.android.youtube/20.10.38 (Linux; U; Android 14)',
    body: (videoId) => ({
      context: {
        client: {
          clientName: 'ANDROID',
          clientVersion: '20.10.38',
          hl: 'en',
          gl: 'US',
        },
      },
      videoId,
      contentCheckOk: true,
      racyCheckOk: true,
    }),
  },
  {
    label: 'IOS',
    userAgent: 'com.google.ios.youtube/20.10.4 (iPhone16,2; U; CPU iOS 18_1 like Mac OS X;)',
    body: (videoId) => ({
      context: {
        client: {
          clientName: 'IOS',
          clientVersion: '20.10.4',
          hl: 'en',
          gl: 'US',
          deviceMake: 'Apple',
          deviceModel: 'iPhone16,2',
        },
      },
      videoId,
      contentCheckOk: true,
      racyCheckOk: true,
    }),
  },
];

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_match, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_match, dec) => String.fromCodePoint(parseInt(dec, 10)));
}

function parseTranscriptXml(xml: string): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];
  const paragraphRegex = /<p\s+t="(\d+)"\s+d="(\d+)"[^>]*>([\s\S]*?)<\/p>/g;
  let paragraphMatch: RegExpExecArray | null;

  while ((paragraphMatch = paragraphRegex.exec(xml)) !== null) {
    const startMs = parseInt(paragraphMatch[1], 10);
    const durationMs = parseInt(paragraphMatch[2], 10);
    const inner = paragraphMatch[3];
    const textParts: string[] = [];
    const spanRegex = /<s[^>]*>([^<]*)<\/s>/g;
    let spanMatch: RegExpExecArray | null;

    while ((spanMatch = spanRegex.exec(inner)) !== null) {
      textParts.push(spanMatch[1]);
    }

    const rawText = textParts.length > 0 ? textParts.join('') : inner.replace(/<[^>]+>/g, '');
    const text = decodeEntities(rawText).trim();
    if (text) {
      segments.push({ text, offset: startMs, duration: durationMs });
    }
  }

  if (segments.length > 0) {
    return segments;
  }

  const textRegex = /<text start="([^"]*)" dur="([^"]*)">([^<]*)<\/text>/g;
  let textMatch: RegExpExecArray | null;

  while ((textMatch = textRegex.exec(xml)) !== null) {
    const text = decodeEntities(textMatch[3]).trim();
    if (text) {
      segments.push({
        text,
        offset: Math.round(parseFloat(textMatch[1]) * 1000),
        duration: Math.round(parseFloat(textMatch[2]) * 1000),
      });
    }
  }

  return segments;
}

async function fetchWithInnerTubeFallback(videoId: string): Promise<TranscriptSegment[]> {
  for (const client of INNER_TUBE_CLIENTS) {
    try {
      const response = await fetch(INNER_TUBE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': client.userAgent,
          'Accept-Language': 'en-US,en;q=0.9',
        },
        body: JSON.stringify(client.body(videoId)),
      });

      if (!response.ok) {
        logger.warn('InnerTube fallback request failed', {
          videoId,
          client: client.label,
          status: response.status,
        });
        continue;
      }

      const data = await response.json() as {
        captions?: {
          playerCaptionsTracklistRenderer?: {
            captionTracks?: CaptionTrack[];
          };
        };
        playabilityStatus?: {
          status?: string;
          reason?: string;
        };
      };

      const tracks = data.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
      if (tracks.length === 0) {
        logger.warn('InnerTube fallback returned no caption tracks', {
          videoId,
          client: client.label,
          playabilityStatus: data.playabilityStatus?.status,
          playabilityReason: data.playabilityStatus?.reason,
        });
        continue;
      }

      const track = tracks.find((t) => t.languageCode === 'en') ?? tracks[0];
      const captionUrl = new URL(track.baseUrl);
      if (!captionUrl.hostname.endsWith('.youtube.com')) {
        logger.warn('InnerTube fallback returned non-YouTube caption URL', {
          videoId,
          client: client.label,
          hostname: captionUrl.hostname,
        });
        continue;
      }

      const transcriptResponse = await fetch(track.baseUrl, {
        headers: {
          'User-Agent': client.userAgent,
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });

      if (!transcriptResponse.ok) {
        logger.warn('InnerTube fallback transcript request failed', {
          videoId,
          client: client.label,
          status: transcriptResponse.status,
        });
        continue;
      }

      const transcriptBody = await transcriptResponse.text();
      const segments = parseTranscriptXml(transcriptBody);
      if (segments.length > 0) {
        logger.info('InnerTube fallback transcript fetched', {
          videoId,
          client: client.label,
          segments: segments.length,
        });
        return segments;
      }

      logger.warn('InnerTube fallback transcript was empty after parsing', {
        videoId,
        client: client.label,
      });
    } catch (err) {
      logger.warn('InnerTube fallback failed', {
        videoId,
        client: client.label,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return [];
}

function getNumber(value: number | string | undefined): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function normalizeApifyTranscriptJson(segments: ApifyTranscriptJsonSegment[]): TranscriptSegment[] {
  return segments.flatMap((segment) => {
    const text = typeof segment.text === 'string' ? segment.text.trim() : '';
    if (!text) return [];

    const startSeconds = getNumber(segment.start) ?? 0;
    const endSeconds = getNumber(segment.end);
    const durationSeconds = getNumber(segment.duration) ?? (endSeconds !== null ? endSeconds - startSeconds : 0);

    return [{
      text,
      offset: Math.max(0, Math.round(startSeconds * 1000)),
      duration: Math.max(0, Math.round(durationSeconds * 1000)),
    }];
  });
}

function splitTranscriptTextIntoSegments(text: string): TranscriptSegment[] {
  const words = text.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  const chunkSize = 90;
  const segments: TranscriptSegment[] = [];

  for (let index = 0; index < words.length; index += chunkSize) {
    const chunk = words.slice(index, index + chunkSize).join(' ').trim();
    if (chunk) {
      segments.push({
        text: chunk,
        offset: 0,
        duration: 0,
      });
    }
  }

  return segments;
}

function normalizeApifyItem(item: ApifyTranscriptItem): TranscriptSegment[] {
  if (Array.isArray(item.transcript_json) && item.transcript_json.length > 0) {
    const segments = normalizeApifyTranscriptJson(item.transcript_json);
    if (segments.length > 0) return segments;
  }

  const plainText = item.transcript_llm || item.transcript_text;
  return typeof plainText === 'string' ? splitTranscriptTextIntoSegments(plainText) : [];
}

function getApifyActorId(): string {
  return (process.env.APIFY_TRANSCRIPT_ACTOR_ID || APIFY_TRANSCRIPT_ACTOR_ID).replace('/', '~');
}

async function fetchWithApifyFallback(videoUrl: string, videoId: string): Promise<TranscriptSegment[]> {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) {
    logger.warn('Apify transcript fallback skipped because APIFY_API_TOKEN is not configured', { videoId });
    return [];
  }

  const endpoint = new URL(`https://api.apify.com/v2/acts/${getApifyActorId()}/run-sync-get-dataset-items`);
  endpoint.searchParams.set('token', token);
  endpoint.searchParams.set('timeout', process.env.APIFY_TRANSCRIPT_TIMEOUT_SECONDS || '180');
  endpoint.searchParams.set('memory', process.env.APIFY_TRANSCRIPT_MEMORY_MB || '4096');
  endpoint.searchParams.set('maxItems', '1');

  const input = {
    startUrls: [{ url: videoUrl }],
    languages: [process.env.APIFY_TRANSCRIPT_LANGUAGE || 'en'],
    outputFormats: ['json', 'llm'],
    maxResults: 1,
    maxAiMinutes: Number(process.env.APIFY_TRANSCRIPT_MAX_AI_MINUTES || '1'),
  };

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });

    const body = await response.text();
    if (!response.ok) {
      logger.warn('Apify transcript fallback request failed', {
        videoId,
        status: response.status,
      });
      return [];
    }

    const items = JSON.parse(body) as ApifyTranscriptItem[];
    const firstItem = Array.isArray(items) ? items[0] : items;
    if (!firstItem) {
      logger.warn('Apify transcript fallback returned no dataset items', { videoId });
      return [];
    }

    if (firstItem.error_code) {
      logger.warn('Apify transcript fallback returned an error item', {
        videoId,
        errorCode: firstItem.error_code,
        errorMessage: firstItem.error_message,
      });
    }

    const segments = normalizeApifyItem(firstItem);
    if (segments.length > 0) {
      logger.info('Apify transcript fallback fetched transcript', {
        videoId,
        segments: segments.length,
        language: firstItem.language,
        isAiGenerated: firstItem.is_ai_generated,
        isAutoGenerated: firstItem.is_auto_generated,
      });
    } else {
      logger.warn('Apify transcript fallback returned no usable transcript content', { videoId });
    }

    return segments;
  } catch (err) {
    logger.warn('Apify transcript fallback failed', {
      videoId,
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

/**
 * Fetch YouTube transcripts via InnerTube, with Apify as a fallback.
 */
export class YouTubeTranscriptService {
  /**
   * Fetch and format the transcript for a YouTube video as Markdown.
   * @param videoUrl - Any supported YouTube URL.
   */
  static async fetchTranscript(videoUrl: string): Promise<YouTubeTranscriptResult> {
    const videoId = extractVideoId(videoUrl);
    if (!videoId) {
      throw new Error(`Invalid YouTube URL or could not extract video ID: ${videoUrl}`);
    }

    logger.info(`Fetching YouTube transcript`, { videoId });

    let segments: TranscriptSegment[];
    const forcedProvider = process.env.YOUTUBE_TRANSCRIPT_PROVIDER?.toLowerCase();

    if (forcedProvider === 'apify') {
      segments = await fetchWithApifyFallback(videoUrl, videoId);
      if (segments.length === 0) {
        throw new Error(`Transcript unavailable from Apify for video ${videoId}`);
      }
    } else {
      segments = await fetchWithInnerTubeFallback(videoId);
      if (segments.length > 0) {
        logger.info('YouTube transcript fetched via InnerTube', {
          videoId,
          segments: segments.length,
        });
      } else {
        logger.warn('InnerTube transcript fetch returned no usable captions; trying Apify fallback', {
          videoId,
        });

        segments = await fetchWithApifyFallback(videoUrl, videoId);
        if (segments.length > 0) {
          logger.info('YouTube transcript fetched via Apify fallback', {
            videoId,
            segments: segments.length,
          });
        } else {
          logger.error('YouTube transcript providers failed', {
            videoId,
            providersTried: ['innertube', 'apify'],
          });
          throw new Error(`Transcript unavailable for video ${videoId}`);
        }
      }
    }

    const totalDurationSeconds = Math.round(
      segments.reduce((sum, s) => sum + s.duration, 0) / 1000
    );

    const lines = segments.map((s) => {
      const ms = s.offset;
      const minutes = Math.floor(ms / 60000);
      const seconds = Math.floor((ms % 60000) / 1000);
      const timestamp = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
      return `[${timestamp}] ${s.text}`;
    });

    const markdownContent = [
      `Source: ${videoUrl}`,
      `Duration: ${totalDurationSeconds}s`,
      ``,
      ...lines,
    ].join('\n');

    logger.info(`YouTube transcript fetched`, { videoId, segments: segments.length });

    return {
      videoId,
      title: `YouTube Video: ${videoId}`,
      markdownContent,
      segments,
    };
  }
}
