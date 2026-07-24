import { ArtifactAgentPipelineFailedError } from '@study-forge/backend-artifacts/artifact-agent/artifact-agent-errors';
import { RateLimitError } from '@study-forge/backend-core/services/api-rate-limit';

/** Total Cloud Tasks attempts for generation jobs (initial try + retries). */
export const MAX_GENERATION_JOB_ATTEMPTS = 2;

const TRANSIENT_HTTP_STATUS_PATTERN =
  /\b(?:429|500|502|503|504)\b|resource-exhausted|too many requests|rate limit|temporarily unavailable|service unavailable|gateway timeout|deadline exceeded|timed out|timeout|ETIMEDOUT|ECONNRESET|ECONNREFUSED|ENOTFOUND|network error|fetch failed|UNAVAILABLE|DEADLINE_EXCEEDED|ABORTED|internal error/i;

const FATAL_MESSAGE_PATTERN =
  /\bnot found\b|already failed|is required|does not exist|has no content|unsupported generation job kind|automated verification failed|invalid|missing|cannot parse|failed to parse|below minimum|empty response from|unsupported screenshot|image too large|validation failed/i;

export function formatGenerationError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export function isRetryableGenerationError(error: unknown): boolean {
  if (error instanceof ArtifactAgentPipelineFailedError) {
    return false;
  }

  if (error instanceof RateLimitError) {
    return false;
  }

  const message = formatGenerationError(error);
  if (!message.trim()) {
    return false;
  }

  if (FATAL_MESSAGE_PATTERN.test(message)) {
    return false;
  }

  if (TRANSIENT_HTTP_STATUS_PATTERN.test(message)) {
    return true;
  }

  const errorCode = getErrorCode(error);
  if (errorCode && isTransientErrorCode(errorCode)) {
    return true;
  }

  return false;
}

function getErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) {
    return undefined;
  }

  const record = error as Record<string, unknown>;
  if (typeof record.code === 'string') {
    return record.code;
  }
  if (typeof record.code === 'number') {
    return String(record.code);
  }
  if (typeof record.status === 'number') {
    return String(record.status);
  }
  return undefined;
}

function isTransientErrorCode(code: string): boolean {
  const normalized = code.toUpperCase();
  return (
    normalized === '429'
    || normalized === '500'
    || normalized === '502'
    || normalized === '503'
    || normalized === '504'
    || normalized === 'UNAVAILABLE'
    || normalized === 'DEADLINE_EXCEEDED'
    || normalized === 'ABORTED'
    || normalized === 'ETIMEDOUT'
    || normalized === 'ECONNRESET'
    || normalized === 'ECONNREFUSED'
    || normalized === 'ENOTFOUND'
  );
}

export function shouldRetryGenerationJob(error: unknown, retryCount: number): boolean {
  return retryCount < MAX_GENERATION_JOB_ATTEMPTS - 1 && isRetryableGenerationError(error);
}
