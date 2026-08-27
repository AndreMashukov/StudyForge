import type { IUserBillingState } from '@shared-types';
import { fetchUserDoc } from './firestoreReadUtils';

function parseBillingStatus(
  value: unknown,
): IUserBillingState['billingStatus'] | undefined {
  if (
    value === 'none'
    || value === 'payment_method_required'
    || value === 'active'
    || value === 'past_due'
    || value === 'disabled'
  ) {
    return value;
  }
  return undefined;
}

export function parseBillingStateFromFirestore(
  raw: Record<string, unknown> | undefined,
): IUserBillingState {
  const billingStatus = parseBillingStatus(raw?.billingStatus) ?? 'none';
  const pricePerCreditCents =
    typeof raw?.pricePerCreditCents === 'number' ? raw.pricePerCreditCents : 0;

  return {
    billingStatus,
    payAsYouGoEnabled: Boolean(raw?.payAsYouGoEnabled),
    monthlyCapCents: typeof raw?.monthlyCapCents === 'number' ? raw.monthlyCapCents : 0,
    pricePerCreditCents,
    defaultPaymentMethodId:
      typeof raw?.defaultPaymentMethodId === 'string'
        ? raw.defaultPaymentMethodId
        : undefined,
    stripeCustomerId:
      typeof raw?.stripeCustomerId === 'string' ? raw.stripeCustomerId : undefined,
  };
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function fetchBillingStateFromFirestore(
  userId: string,
): Promise<IUserBillingState> {
  const snapshot = await fetchUserDoc<{ id: string }>(userId, 'billing', 'state');
  return parseBillingStateFromFirestore(isPlainRecord(snapshot) ? snapshot : undefined);
}
