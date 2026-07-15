import { Timestamp } from 'firebase-admin/firestore';

/** Retention windows for raw/transient Firestore records (days). */
export const TTL_RETENTION_DAYS = {
  generationJob: 30,
  interactionSession: 180,
  learningRaw: 180,
  directoryChat: 90,
} as const;

export type TtlRetentionCategory = keyof typeof TTL_RETENTION_DAYS;

function addDays(from: Date, days: number): Date {
  const result = new Date(from);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

export function computeExpiresAt(from: Date, category: TtlRetentionCategory): Timestamp {
  return Timestamp.fromDate(addDays(from, TTL_RETENTION_DAYS[category]));
}
