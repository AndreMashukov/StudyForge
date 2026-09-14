import { afterEach, describe, expect, it } from 'vitest';
import {
  applyLangSmithProcessDefaults,
  isLangSmithTracingEnabled,
} from './langsmith-tracing';

describe('isLangSmithTracingEnabled', () => {
  const originalTracing = process.env.LANGSMITH_TRACING;
  const originalApiKey = process.env.LANGSMITH_API_KEY;

  afterEach(() => {
    if (originalTracing === undefined) {
      delete process.env.LANGSMITH_TRACING;
    } else {
      process.env.LANGSMITH_TRACING = originalTracing;
    }
    if (originalApiKey === undefined) {
      delete process.env.LANGSMITH_API_KEY;
    } else {
      process.env.LANGSMITH_API_KEY = originalApiKey;
    }
  });

  it('is false when tracing is not enabled', () => {
    delete process.env.LANGSMITH_TRACING;
    process.env.LANGSMITH_API_KEY = 'test-key';
    expect(isLangSmithTracingEnabled()).toBe(false);
  });

  it('is false when the API key is missing', () => {
    process.env.LANGSMITH_TRACING = 'true';
    delete process.env.LANGSMITH_API_KEY;
    expect(isLangSmithTracingEnabled()).toBe(false);
  });

  it('is true when tracing and the API key are set', () => {
    process.env.LANGSMITH_TRACING = 'true';
    process.env.LANGSMITH_API_KEY = 'test-key';
    expect(isLangSmithTracingEnabled()).toBe(true);
  });

  it('enables tracing when an API key is present and tracing is unset', () => {
    delete process.env.LANGSMITH_TRACING;
    process.env.LANGSMITH_API_KEY = 'test-key';
    applyLangSmithProcessDefaults();
    expect(isLangSmithTracingEnabled()).toBe(true);
  });
});
