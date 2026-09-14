import { Client } from 'langsmith';
import { traceable } from 'langsmith/traceable';
import { getProviderCostContext } from './provider-cost/provider-cost-context';

const DEFAULT_LANGSMITH_PROJECT = 'study-forge';

export function isLangSmithTracingEnabled(): boolean {
  const tracing = process.env.LANGSMITH_TRACING;
  const apiKey = process.env.LANGSMITH_API_KEY;
  return (
    (tracing === 'true' || tracing === '1') &&
    typeof apiKey === 'string' &&
    apiKey.trim().length > 0
  );
}

/**
 * Serverless Functions exit as soon as the handler returns. Force sync
 * trace uploads unless the operator already set a preference.
 */
export function applyLangSmithProcessDefaults(): void {
  if (!process.env.LANGSMITH_TRACING_BACKGROUND) {
    process.env.LANGSMITH_TRACING_BACKGROUND = 'false';
  }
  if (!process.env.LANGSMITH_PROJECT) {
    process.env.LANGSMITH_PROJECT = DEFAULT_LANGSMITH_PROJECT;
  }
  const tracing = process.env.LANGSMITH_TRACING;
  const hasApiKey =
    typeof process.env.LANGSMITH_API_KEY === 'string' &&
    process.env.LANGSMITH_API_KEY.trim().length > 0;
  if (hasApiKey && (tracing === undefined || tracing === '')) {
    process.env.LANGSMITH_TRACING = 'true';
  }
}

let langsmithClient: Client | null = null;

export function getLangSmithClient(): Client | null {
  if (!isLangSmithTracingEnabled()) {
    return null;
  }
  if (!langsmithClient) {
    langsmithClient = new Client();
  }
  return langsmithClient;
}

export async function flushLangSmithTraces(): Promise<void> {
  const client = getLangSmithClient();
  if (!client) {
    return;
  }
  try {
    await client.awaitPendingTraceBatches();
  } catch {
    // Flush failures must not replace the pipeline result or error.
  }
}

const SECRET_KEY_PATTERN = /api[_-]?key|authorization|secret|token|password/i;

function isKvMap(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function redactSecrets(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactSecrets);
  }
  if (isKvMap(value)) {
    const result: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      result[key] = SECRET_KEY_PATTERN.test(key)
        ? '[redacted]'
        : redactSecrets(nested);
    }
    return result;
  }
  return value;
}

export interface ILangSmithTraceableOptions {
  name: string;
  runType?: 'llm' | 'chain' | 'tool';
}

export function withLangSmithTrace<Args extends unknown[], Result>(
  fn: (...args: Args) => Promise<Result>,
  options: ILangSmithTraceableOptions,
) {
  return traceable(fn, {
    name: options.name,
    run_type: options.runType ?? 'chain',
    processInputs: (inputs) => {
      const redacted = redactSecrets(inputs);
      return isKvMap(redacted) ? redacted : {};
    },
  });
}

export interface ILangGraphTraceConfigInput {
  runName: string;
  tags: string[];
  metadata?: Record<string, string>;
}

export interface ILangGraphTraceConfig {
  runName: string;
  tags: string[];
  metadata: Record<string, string>;
}

export function buildLangGraphTraceConfig(
  input: ILangGraphTraceConfigInput,
): ILangGraphTraceConfig {
  const costContext = getProviderCostContext();
  return {
    runName: input.runName,
    tags: input.tags,
    metadata: {
      ...(costContext?.userId ? { userId: costContext.userId } : {}),
      ...(costContext?.jobId ? { jobId: costContext.jobId } : {}),
      ...(costContext?.generationKind
        ? { generationKind: costContext.generationKind }
        : {}),
      ...input.metadata,
    },
  };
}
