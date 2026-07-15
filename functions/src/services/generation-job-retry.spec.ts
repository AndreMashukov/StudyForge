import { describe, expect, it } from 'vitest';
import { ArtifactAgentPipelineFailedError } from './artifact-agent/artifact-agent-errors';
import { RateLimitError } from './api-rate-limit';
import {
  formatGenerationError,
  isRetryableGenerationError,
  MAX_GENERATION_JOB_ATTEMPTS,
  shouldRetryGenerationJob,
} from './generation-job-retry';

describe('generation-job-retry', () => {
  it('formats unknown errors as strings', () => {
    expect(formatGenerationError(new Error('boom'))).toBe('boom');
    expect(formatGenerationError('plain')).toBe('plain');
  });

  it('treats artifact agent verification failures as fatal', () => {
    const error = new ArtifactAgentPipelineFailedError('Automated verification failed');
    expect(isRetryableGenerationError(error)).toBe(false);
  });

  it('treats rate limit errors as fatal', () => {
    const error = new RateLimitError('Hourly limit reached', 60, 'quiz');
    expect(isRetryableGenerationError(error)).toBe(false);
  });

  it('treats missing records and validation errors as fatal', () => {
    expect(isRetryableGenerationError(new Error('Pending quiz abc not found'))).toBe(false);
    expect(isRetryableGenerationError(new Error('documentIds is required'))).toBe(false);
    expect(isRetryableGenerationError(new Error('Document doc-1 does not exist or has no content'))).toBe(false);
  });

  it('treats provider and infrastructure failures as retryable', () => {
    expect(isRetryableGenerationError(new Error('OpenRouter API error 503: upstream unavailable'))).toBe(true);
    expect(isRetryableGenerationError(new Error('MiniMax API error 429: rate limited'))).toBe(true);
    expect(isRetryableGenerationError(new Error('fetch failed: ETIMEDOUT'))).toBe(true);
    expect(isRetryableGenerationError({ code: 'UNAVAILABLE', message: 'Firestore unavailable' })).toBe(true);
  });

  it('allows retry only before the final attempt', () => {
    const error = new Error('OpenRouter API error 500: internal');
    expect(shouldRetryGenerationJob(error, 0)).toBe(true);
    expect(shouldRetryGenerationJob(error, MAX_GENERATION_JOB_ATTEMPTS - 1)).toBe(false);
  });

  it('does not retry fatal errors even on the first attempt', () => {
    const error = new Error('Pending slide deck abc not found');
    expect(shouldRetryGenerationJob(error, 0)).toBe(false);
  });
});
