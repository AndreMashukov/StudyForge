/** Default suggested monthly overage cap ($20). */
export const DEFAULT_PAYG_MONTHLY_CAP_CENTS = 2_000;

/** Default global price per StudyForge credit (2.5 cents / $0.025). */
export const DEFAULT_PRICE_PER_CREDIT_CENTS = 2.5;

/** Default web origins allowed for Stripe billing redirect URLs. */
export const DEFAULT_BILLING_REDIRECT_ORIGINS = [
  'http://localhost:4200',
  'https://study-forge-202604.web.app',
  'https://study-forge-202604.firebaseapp.com',
] as const;

export type BillingStatus =
  | 'none'
  | 'payment_method_required'
  | 'active'
  | 'past_due'
  | 'disabled';

export type SubscriptionStatus =
  | 'none'
  | 'incomplete'
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'unpaid'
  | 'paused';

export interface IBillingConfig {
  pricePerCreditCents: number;
  updatedAt?: string;
}

export interface IUserBillingState {
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  stripePriceId?: string;
  defaultPaymentMethodId?: string;
  payAsYouGoEnabled: boolean;
  monthlyCapCents: number;
  /** Snapshot of the global price applied when billing was last updated. */
  pricePerCreditCents: number;
  billingStatus: BillingStatus;
  subscriptionStatus?: SubscriptionStatus;
  subscriptionUsageLimitsSetupId?: string;
  subscriptionUserGroupId?: string;
  subscriptionCurrentPeriodEnd?: string;
  cancelAtPeriodEnd?: boolean;
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

export interface ICreateBillingCheckoutSessionRequest {
  origin: string;
  usageLimitsSetupId: string;
}

export interface ICreateBillingPortalSessionRequest {
  origin: string;
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

/** Format per-credit unit price (supports fractional cents such as 2.5). */
export function formatCreditUnitPriceFromCents(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(cents / 100);
}

/** Round accumulated fractional overage to integer cents for Stripe invoice items. */
export function roundInvoiceAmountCents(exactCents: number): number {
  if (exactCents <= 0 || !Number.isFinite(exactCents)) {
    return 0;
  }
  return Math.round(exactCents);
}
