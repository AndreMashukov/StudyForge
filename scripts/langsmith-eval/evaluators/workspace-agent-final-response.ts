const CANNED_FALLBACK =
  'I completed the planned steps but could not compose a final reply.';

export interface IEvalRunLike {
  outputs?: unknown;
}

export interface IEvalExampleLike {
  outputs?: unknown;
}

function isKvMap(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function readRunOutputs(run: IEvalRunLike): Record<string, unknown> {
  return isKvMap(run.outputs) ? run.outputs : {};
}

export function readExampleOutputs(
  example: IEvalExampleLike,
): Record<string, unknown> {
  return isKvMap(example.outputs) ? example.outputs : {};
}

export function extractFinalReply(run: IEvalRunLike): string {
  const outputs = readRunOutputs(run);
  const reply = outputs.finalReply;
  return typeof reply === 'string' ? reply : '';
}

export function extractMustNotContain(example: IEvalExampleLike): string {
  const outputs = readExampleOutputs(example);
  const banned = outputs.mustNotContain;
  return typeof banned === 'string' && banned.trim().length > 0
    ? banned
    : CANNED_FALLBACK;
}

export function cannedFallbackEvaluator(
  run: IEvalRunLike,
  example: IEvalExampleLike,
): { key: string; score: number; comment: string } {
  const reply = extractFinalReply(run);
  const banned = extractMustNotContain(example);
  const hit = reply.includes(banned);
  return {
    key: 'no_canned_fallback',
    score: hit ? 0 : 1,
    comment: hit
      ? `Reply contains banned fallback: "${banned}"`
      : 'Reply does not contain the canned planner fallback.',
  };
}

export function nonemptyReplyEvaluator(run: IEvalRunLike): {
  key: string;
  score: number;
  comment: string;
} {
  const reply = extractFinalReply(run).trim();
  return {
    key: 'nonempty_reply',
    score: reply.length > 0 ? 1 : 0,
    comment:
      reply.length > 0
        ? `Reply length ${reply.length}`
        : 'finalReply is missing or empty',
  };
}
