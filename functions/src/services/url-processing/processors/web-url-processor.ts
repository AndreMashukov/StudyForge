import { logger } from 'firebase-functions/v2';
import { WebScraperService } from '../../scraper';
import { UrlSourceProcessor, UrlProcessingInput, UrlProcessingResult } from '../types';

export class WebUrlProcessor implements UrlSourceProcessor {
  readonly type = 'web' as const;

  canProcess(url: URL): boolean {
    // Accepts any http/https URL that is not a YouTube URL.
    // YouTube detection is handled by the YouTubeUrlProcessor earlier in registry order.
    return url.protocol === 'http:' || url.protocol === 'https:';
  }

  async process(input: UrlProcessingInput): Promise<UrlProcessingResult> {
    const { url, ruleIds, userId } = input;

    logger.info('WebUrlProcessor: scraping URL', { url });

    const scraped = await WebScraperService.extractContentAsMarkdown(url, ruleIds, userId);

    if (!scraped.markdownContent || scraped.markdownContent.trim().length === 0) {
      throw new Error(`Failed to extract content from ${url}`);
    }

    const wordCount = scraped.markdownContent.split(/\s+/).filter(Boolean).length;

    return {
      url,
      type: 'web',
      title: scraped.title || url,
      markdownContent: scraped.markdownContent,
      wordCount,
    };
  }
}
