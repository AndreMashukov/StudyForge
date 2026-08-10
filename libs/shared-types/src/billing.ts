/** Default suggested monthly overage cap ($20). */
export const DEFAULT_PAYG_MONTHLY_CAP_CENTS = 2_000;

/** Default global price per StudyForge credit (5 cents). */
export const DEFAULT_PRICE_PER_CREDIT_CENTS = 5;

export type BillingStatus =
  | 'none'
  | 'payment_method_required'
  | 'active'
  | 'past_due'
  | 'disabled';

export interface IBillingConfig {
  pricePerCreditCents: number;
  updatedAt?: string;
}

export interface IUserBillingState {
  stripeCustomerId?: string;
  defaultPaymentMethodId?: string;
  payAsYouGoEnabled: boolean;
  monthlyCapCents: number;
  /** Snapshot of the global price applied when billing was last updated. */
  pricePerCreditCents: number;
  billingStatus: BillingStatus;
  updatedAt?: string;
}

export interface IUsagePayAsYouGoSummary {
  enabled: boolean;
  monthlyCapCents: number;
  remainingCapCents: number;
  spentOverageAmountCents: number;
  reservedOverageAmountCents: number;
  spentOverageCredits: number;
  reservedOverageCredits: number;
  pricePerCreditCents: number;
  billingStatus: BillingStatus;
  hasPaymentMethod: boolean;
}

export interface IUpdatePayAsYouGoSettingsRequest {
  enabled: boolean;
  monthlyCapCents: number;
}

export interface ICreateBillingCheckoutSessionResponse {
  checkoutUrl: string;
}

export interface ICreateBillingPortalSessionResponse {
  portalUrl: string;
}

export interface IUsageCreditSplit {
  includedCredits: number;
  overageCredits: number;
  overageAmountCents: number;
}

export function calculateOverageAmountCents(
  overageCredits: number,
  pricePerCreditCents: number,
): number {
  if (overageCredits <= 0 || pricePerCreditCents <= 0) {
    return 0;
  }
  return overageCredits * pricePerCreditCents;
}

export function calculateRemainingOverageCapCents(params: {
  monthlyCapCents: number;
  overageAmountCents: number;
  reservedOverageAmountCents: number;
}): number {
  const used =
    Math.max(0, params.overageAmountCents) + Math.max(0, params.reservedOverageAmountCents);
  return Math.max(0, params.monthlyCapCents - used);
}

export function formatCurrencyFromCents(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}
