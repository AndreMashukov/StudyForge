import type {
  IUsageDailySlideDeckSummary,
  IUsageStorageSummary,
  IUserUsageSummary,
} from '@shared-types';

const CREDIT_FORMATTER = new Intl.NumberFormat('en-US');
const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const;

export function calculateUsedCredits(summary: IUserUsageSummary): number {
  return summary.reservedCredits + summary.spentCredits;
}

export function calculateUsagePercent(summary: IUserUsageSummary): number {
  if (summary.allowance <= 0) {
    return 0;
  }
  const raw = (calculateUsedCredits(summary) / summary.allowance) * 100;
  return Math.max(0, Math.min(100, raw));
}

export function calculateStorageUsagePercent(storage: IUsageStorageSummary): number {
  if (storage.limitBytes <= 0) {
    return 0;
  }
  const raw = (storage.usedBytes / storage.limitBytes) * 100;
  return Math.max(0, Math.min(100, raw));
}

export function calculateDailySlideDeckUsagePercent(
  dailySlideDecks: IUsageDailySlideDeckSummary,
): number {
  if (dailySlideDecks.limit <= 0) {
    return dailySlideDecks.used > 0 ? 100 : 0;
  }
  const raw = (dailySlideDecks.used / dailySlideDecks.limit) * 100;
  return Math.max(0, Math.min(100, raw));
}

export function formatStorageBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 B';
  }

  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < BYTE_UNITS.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const formatted = value >= 10 || unitIndex === 0 ? value.toFixed(0) : value.toFixed(1);
  return `${formatted} ${BYTE_UNITS[unitIndex]}`;
}

export function formatCreditCount(value: number): string {
  return CREDIT_FORMATTER.format(value);
}

export const MONTHLY_CAP_ERROR_MESSAGE = 'Enter a whole dollar amount of at least $1.';

export function parseMonthlyCapDollars(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) {
    return null;
  }

  const dollars = Number(trimmed);
  if (!Number.isSafeInteger(dollars) || dollars < 1) {
    return null;
  }

  const cents = dollars * 100;
  if (!Number.isSafeInteger(cents)) {
    return null;
  }

  return dollars;
}

export function monthlyCapDollarsToCents(dollars: number): number {
  return dollars * 100;
}

export function isMonthlyCapInputDirty(
  monthlyCapDollars: string,
  savedCapCents: number,
): boolean {
  const parsed = parseMonthlyCapDollars(monthlyCapDollars);
  if (parsed !== null) {
    return monthlyCapDollarsToCents(parsed) !== savedCapCents;
  }

  return monthlyCapDollars.trim() !== String(savedCapCents / 100);
}

export function roundPercent(value: number): number {
  return Math.round(value);
}
