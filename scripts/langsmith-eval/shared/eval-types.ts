export interface IEvalRunLike {
  outputs?: unknown;
}

export interface IEvalExampleLike {
  outputs?: unknown;
  inputs?: unknown;
}

export function isKvMap(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
