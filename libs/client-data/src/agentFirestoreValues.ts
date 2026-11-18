import { Timestamp } from 'firebase/firestore';
import type { z } from 'zod';

export function timestampToIso(value: unknown, fallback: string): string {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
  }
  return fallback;
}

export function optionalTimestampToIso(value: unknown): string | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  const iso = timestampToIso(value, '');
  return iso.length > 0 ? iso : undefined;
}

export function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined;
}

/** Parses each entry on its own, so one malformed entry never drops the list. */
export function parseList<T>(
  value: unknown,
  schema: z.ZodType<T>,
): T[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  return value.flatMap((entry) => {
    const parsed = schema.safeParse(entry);
    return parsed.success ? [parsed.data] : [];
  });
}
