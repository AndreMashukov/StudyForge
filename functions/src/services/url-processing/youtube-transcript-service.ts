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

      if (
        message.includes('disabled') ||
        message.includes('captions') ||
        message.includes('subtitles')
      ) {
        throw new Error(`Transcript unavailable: captions are disabled for this video (${videoId})`);
      }
      if (message.includes('blocked') || message.includes('403') || message.includes('429')) {
        throw new Error(`Transcript fetch was blocked by YouTube (${videoId}). Try again later.`);
      }
      if (message.includes('empty')) {
        throw new Error(`Transcript is empty for video ${videoId}`);
      }

      throw new Error(`Failed to fetch YouTube transcript for ${videoId}: ${message}`);
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
