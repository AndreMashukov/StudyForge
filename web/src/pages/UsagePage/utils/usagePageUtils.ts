import type { IUserUsageSummary } from '@shared-types';

const CREDIT_FORMATTER = new Intl.NumberFormat('en-US');

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

export function formatCreditCount(value: number): string {
  return CREDIT_FORMATTER.format(value);
}

export function roundPercent(value: number): number {
  return Math.round(value);
}
