import { logger } from 'firebase-functions/v2';
import { UrlSourceProcessor, UrlProcessingInput, UrlProcessingResult } from '../types';
import { isYouTubeUrl } from '../youtube-url-utils';
import { YouTubeTranscriptService } from '../youtube-transcript-service';

export class YouTubeUrlProcessor implements UrlSourceProcessor {
  readonly type = 'youtube' as const;

  canProcess(url: URL): boolean {
    return isYouTubeUrl(url.toString());
  }

  async process(input: UrlProcessingInput): Promise<UrlProcessingResult> {
    const { url } = input;

    logger.info('YouTubeUrlProcessor: fetching transcript', { url });

    const result = await YouTubeTranscriptService.fetchTranscript(url);

    const wordCount = result.markdownContent.split(/\s+/).filter(Boolean).length;

    return {
      url,
      type: 'youtube',
      title: result.title,
      markdownContent: result.markdownContent,
      wordCount,
    };
  }
}
