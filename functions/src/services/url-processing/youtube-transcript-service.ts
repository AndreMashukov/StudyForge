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

const INNER_TUBE_URL = 'https://www.youtube.com/youtubei/v1/player?prettyPrint=false';

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

/**
 * Adapter around the `youtube-transcript` npm package.
 * This is the only place in the codebase that imports that package directly.
 * Swap the import here if the package needs to be replaced.
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

    // Dynamic import so the package is only loaded for YouTube requests
    const { fetchTranscript } = await import('youtube-transcript');

    let segments: TranscriptSegment[];
    try {
      const raw = await fetchTranscript(videoId);

      if (!raw || raw.length === 0) {
        throw new Error('Transcript is empty. The video may have captions disabled or no captions available.');
      }

      segments = raw.map((s) => ({
        text: s.text,
        offset: s.offset,
        duration: s.duration,
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.warn('youtube-transcript package failed; trying InnerTube fallback', {
        videoId,
        error: message,
      });

      segments = await fetchWithInnerTubeFallback(videoId);
      if (segments.length > 0) {
        logger.info('YouTube transcript fetched via fallback', {
          videoId,
          segments: segments.length,
        });
      } else {
        logger.error('YouTube transcript fallback failed', {
          videoId,
          originalError: message,
        });

        if (
          message.includes('disabled') ||
          message.includes('captions') ||
          message.includes('subtitles')
        ) {
          throw new Error(`Transcript unavailable: captions are disabled or unavailable for this video (${videoId})`);
        }
        if (message.includes('blocked') || message.includes('403') || message.includes('429')) {
          throw new Error(`Transcript fetch was blocked by YouTube (${videoId}). Try again later.`);
        }
        if (message.includes('empty')) {
          throw new Error(`Transcript is empty for video ${videoId}`);
        }

        throw new Error(`Failed to fetch YouTube transcript for ${videoId}: ${message}`);
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
