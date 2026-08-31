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

function parseSubscriptionStatus(
  value: unknown,
): IUserBillingState['subscriptionStatus'] | undefined {
  if (
    value === 'none' ||
    value === 'incomplete' ||
    value === 'trialing' ||
    value === 'active' ||
    value === 'past_due' ||
    value === 'canceled' ||
    value === 'unpaid' ||
    value === 'paused'
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
    stripeSubscriptionId:
      typeof raw?.stripeSubscriptionId === 'string' ? raw.stripeSubscriptionId : undefined,
    stripePriceId: typeof raw?.stripePriceId === 'string' ? raw.stripePriceId : undefined,
    subscriptionStatus: parseSubscriptionStatus(raw?.subscriptionStatus) ?? 'none',
    subscriptionUsageLimitsSetupId:
      typeof raw?.subscriptionUsageLimitsSetupId === 'string'
        ? raw.subscriptionUsageLimitsSetupId
        : undefined,
    subscriptionUserGroupId:
      typeof raw?.subscriptionUserGroupId === 'string'
        ? raw.subscriptionUserGroupId
        : undefined,
    subscriptionCurrentPeriodEnd:
      typeof raw?.subscriptionCurrentPeriodEnd === 'string'
        ? raw.subscriptionCurrentPeriodEnd
        : undefined,
    cancelAtPeriodEnd: raw?.cancelAtPeriodEnd === true,
  };
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function fetchBillingStateFromFirestore(
  userId: string,
): Promise<IUserBillingState> {
  const snapshot = await fetchUserDoc<{ id: string }>(userId, 'billing', 'current');
  return parseBillingStateFromFirestore(isPlainRecord(snapshot) ? snapshot : undefined);
}
