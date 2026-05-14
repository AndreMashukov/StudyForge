import { logger } from 'firebase-functions/v2';
import {
  UrlSourceProcessor,
  UrlProcessingInput,
  UrlProcessingResult,
  UrlProcessingSummary,
} from './types';
import { YouTubeUrlProcessor } from './processors/youtube-url-processor';
import { WebUrlProcessor } from './processors/web-url-processor';

const MAX_URLS = 20;
const CONCURRENCY = 3;

/**
 * Processor registry. Checked in order — more specific processors first.
 * Add a new processor here to support additional source types without modifying
 * the orchestrator logic.
 */
const PROCESSOR_REGISTRY: UrlSourceProcessor[] = [
  new YouTubeUrlProcessor(),
  new WebUrlProcessor(),
];

function selectProcessor(url: URL): UrlSourceProcessor | null {
  for (const processor of PROCESSOR_REGISTRY) {
    if (processor.canProcess(url)) {
      return processor;
    }
  }
  return null;
}

/**
 * Run tasks with bounded concurrency.
 * Resolves all tasks using allSettled semantics so failures don't abort siblings.
 */
async function runBounded<T>(
  tasks: Array<() => Promise<T>>,
  concurrency: number
): Promise<Array<PromiseSettledResult<T>>> {
  const results: Array<PromiseSettledResult<T>> = new Array(tasks.length);
  let index = 0;

  async function worker(): Promise<void> {
    while (index < tasks.length) {
      const taskIndex = index++;
      try {
        results[taskIndex] = { status: 'fulfilled', value: await tasks[taskIndex]() };
      } catch (err) {
        results[taskIndex] = {
          status: 'rejected',
          reason: err,
        };
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

function buildMergedMarkdown(
  successful: UrlProcessingResult[],
  failed: Array<{ url: string; error: string }>
): string {
  const sourceCount = successful.length;

  const sections = successful.map((r, i) => {
    const typeLabel = r.type === 'youtube' ? 'youtube' : 'web';
    return [
      `## Source ${i + 1}: ${r.title}`,
      ``,
      `Source: ${r.url}`,
      `Type: ${typeLabel}`,
      ``,
      r.markdownContent,
    ].join('\n');
  });

  const failedSection =
    failed.length > 0
      ? [
          ``,
          `---`,
          ``,
          `## Failed Sources`,
          ``,
          ...failed.map((f) => `- ${f.url}: ${f.error}`),
        ].join('\n')
      : '';

  return [
    `# Merged Document (${sourceCount} source${sourceCount !== 1 ? 's' : ''})`,
    ``,
    `Generated from ${sourceCount} URL${sourceCount !== 1 ? 's' : ''}.`,
    ``,
    `---`,
    ``,
    ...sections.flatMap((s, i) => (i < sections.length - 1 ? [s, '', '---', ''] : [s])),
    failedSection,
  ]
    .join('\n')
    .trim();
}

/**
 * Orchestration facade for multi-URL processing.
 *
 * Normalizes and validates incoming URLs, selects the appropriate processor
 * via the registry, processes with bounded concurrency, aggregates partial
 * failures, and returns a single merged Markdown document.
 */
export class UrlProcessingOrchestrator {
  /**
   * @param rawUrls - Raw URL strings from the request (already basic-validated).
   * @param ruleIds - Scraping rule IDs to pass to web processors.
   * @param userId - Authenticated user ID.
   * @returns Processing summary including merged Markdown and per-source results.
   * @throws Error if every URL fails to process.
   */
  static async processUrls(
    rawUrls: string[],
    ruleIds?: string[],
    userId?: string
  ): Promise<UrlProcessingSummary> {
    // Normalize, dedupe
    const urls = [...new Set(rawUrls.map((u) => u.trim()).filter(Boolean))];

    if (urls.length > MAX_URLS) {
      throw new Error(`Too many URLs: ${urls.length} submitted, maximum is ${MAX_URLS}.`);
    }

    logger.info('UrlProcessingOrchestrator: processing URLs', {
      count: urls.length,
      hasRules: !!(ruleIds && ruleIds.length > 0),
    });

    // Build task list
    const tasks = urls.map((url) => async (): Promise<UrlProcessingResult> => {
      let parsed: URL;
      try {
        parsed = new URL(url);
      } catch {
        throw new Error(`Invalid URL format: ${url}`);
      }

      const processor = selectProcessor(parsed);
      if (!processor) {
        throw new Error(`No processor available for URL: ${url}`);
      }

      const input: UrlProcessingInput = { url, ruleIds, userId };
      return processor.process(input);
    });

    // Process with bounded concurrency
    const settled = await runBounded(tasks, CONCURRENCY);

    const results: UrlProcessingResult[] = [];
    const successful: UrlProcessingResult[] = [];
    const failed: Array<{ url: string; error: string }> = [];

    settled.forEach((outcome, i) => {
      if (outcome.status === 'fulfilled') {
        results.push(outcome.value);
        successful.push(outcome.value);
      } else {
        const error = outcome.reason instanceof Error
          ? outcome.reason.message
          : String(outcome.reason);
        const failedResult: UrlProcessingResult = {
          url: urls[i],
          type: 'web',
          title: urls[i],
          markdownContent: '',
          wordCount: 0,
          error,
        };
        results.push(failedResult);
        failed.push({ url: urls[i], error });
      }
    });

    if (successful.length === 0) {
      const errors = failed.map((f) => `${f.url}: ${f.error}`).join('; ');
      throw new Error(`All URL processing failed: ${errors}`);
    }

    if (failed.length > 0) {
      logger.warn('UrlProcessingOrchestrator: some URLs failed', {
        failed: failed.length,
        successful: successful.length,
      });
    }

    const mergedMarkdown = buildMergedMarkdown(successful, failed);
    const totalWordCount = successful.reduce((sum, r) => sum + r.wordCount, 0);

    logger.info('UrlProcessingOrchestrator: processing complete', {
      total: urls.length,
      successful: successful.length,
      failed: failed.length,
      totalWords: totalWordCount,
    });

    return {
      results,
      mergedMarkdown,
      totalWordCount,
      sourceUrls: urls,
      successfulCount: successful.length,
      failedCount: failed.length,
    };
  }
}
