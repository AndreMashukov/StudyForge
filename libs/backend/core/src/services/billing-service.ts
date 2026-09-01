import {
  calculateRemainingOverageCapCents,
  DEFAULT_PAYG_MONTHLY_CAP_CENTS,
  DEFAULT_PRICE_PER_CREDIT_CENTS,
  roundInvoiceAmountCents,
  type BillingStatus,
  type IBillingConfig,
  type ISubscriptionPlanSummary,
  type IUpdatePayAsYouGoSettingsRequest,
  type IUsagePayAsYouGoSummary,
  type IUserBillingState,
  type SubscriptionStatus,
} from '@shared-types';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import Stripe from 'stripe';
import type { IUsageBillingContext } from './usage-limits-logic';

const USERS_COLLECTION = 'users';
const BILLING_CONFIG_COLLECTION = 'billingConfig';
const BILLING_CONFIG_DOC_ID = 'global';
const BILLING_STATE_DOC_ID = 'current';
const USAGE_LIMITS_SETUPS_COLLECTION = 'usageLimitsSetups';
const USER_GROUPS_COLLECTION = 'userGroups';

export function billingStateRef(userId: string) {
  return getFirestore()
    .collection(USERS_COLLECTION)
    .doc(userId)
    .collection('billing')
    .doc(BILLING_STATE_DOC_ID);
}

function billingConfigRef() {
  return getFirestore().collection(BILLING_CONFIG_COLLECTION).doc(BILLING_CONFIG_DOC_ID);
}

function usagePeriodRef(userId: string, periodKey: string) {
  return getFirestore()
    .collection(USERS_COLLECTION)
    .doc(userId)
    .collection('usagePeriods')
    .doc(periodKey);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseBillingStatus(value: unknown): BillingStatus {
  if (
    value === 'none' ||
    value === 'payment_method_required' ||
    value === 'active' ||
    value === 'past_due' ||
    value === 'disabled'
  ) {
    return value;
  }
  return 'none';
}

function parseSubscriptionStatus(value: unknown): SubscriptionStatus {
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
  return 'none';
}

function parseOptionalPositiveInteger(value: unknown): number | undefined {
  return typeof value === 'number' &&
    Number.isFinite(value) &&
    Number.isSafeInteger(value) &&
    value >= 0
    ? value
    : undefined;
}

function parseOptionalNonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function parseStoredPricePerCreditCents(
  data: FirebaseFirestore.DocumentData | undefined,
): number | undefined {
  const record = data ?? {};
  return typeof record.pricePerCreditCents === 'number' && record.pricePerCreditCents > 0
    ? record.pricePerCreditCents
    : undefined;
}

export function parseUserBillingState(
  data: FirebaseFirestore.DocumentData | undefined,
  options?: { defaultPricePerCreditCents?: number },
): IUserBillingState {
  const record = data ?? {};
  const storedPrice = parseStoredPricePerCreditCents(record);

  return {
    stripeCustomerId:
      typeof record.stripeCustomerId === 'string' ? record.stripeCustomerId : undefined,
    stripeSubscriptionId:
      typeof record.stripeSubscriptionId === 'string'
        ? record.stripeSubscriptionId
        : undefined,
    stripePriceId:
      typeof record.stripePriceId === 'string' ? record.stripePriceId : undefined,
    defaultPaymentMethodId:
      typeof record.defaultPaymentMethodId === 'string'
        ? record.defaultPaymentMethodId
        : undefined,
    payAsYouGoEnabled: record.payAsYouGoEnabled === true,
    monthlyCapCents:
      typeof record.monthlyCapCents === 'number' && record.monthlyCapCents > 0
        ? record.monthlyCapCents
        : DEFAULT_PAYG_MONTHLY_CAP_CENTS,
    pricePerCreditCents:
      storedPrice ?? options?.defaultPricePerCreditCents ?? DEFAULT_PRICE_PER_CREDIT_CENTS,
    billingStatus: parseBillingStatus(record.billingStatus),
    subscriptionStatus: parseSubscriptionStatus(record.subscriptionStatus),
    subscriptionUsageLimitsSetupId:
      typeof record.subscriptionUsageLimitsSetupId === 'string'
        ? record.subscriptionUsageLimitsSetupId
        : undefined,
    subscriptionUserGroupId:
      typeof record.subscriptionUserGroupId === 'string'
        ? record.subscriptionUserGroupId
        : undefined,
    subscriptionCurrentPeriodEnd:
      typeof record.subscriptionCurrentPeriodEnd === 'string'
        ? record.subscriptionCurrentPeriodEnd
        : undefined,
    cancelAtPeriodEnd: record.cancelAtPeriodEnd === true,
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : undefined,
  };
}

interface IBillingStateWrite {
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  stripePriceId?: string;
  defaultPaymentMethodId?: string;
  payAsYouGoEnabled?: boolean;
  monthlyCapCents?: number;
  pricePerCreditCents?: number;
  billingStatus?: BillingStatus;
  subscriptionStatus?: SubscriptionStatus;
  subscriptionUsageLimitsSetupId?: string;
  subscriptionUserGroupId?: string;
  subscriptionCurrentPeriodEnd?: string;
  cancelAtPeriodEnd?: boolean;
}

function isActiveStripeCustomer(
  customer: Stripe.Customer | Stripe.DeletedCustomer,
): customer is Stripe.Customer {
  return !customer.deleted;
}

function buildBillingStateWrite(fields: IBillingStateWrite): FirebaseFirestore.DocumentData {
  const write: FirebaseFirestore.DocumentData = {
    updatedAt: new Date().toISOString(),
  };

  if (fields.stripeCustomerId !== undefined) {
    write.stripeCustomerId = fields.stripeCustomerId;
  }
  if (fields.stripeSubscriptionId !== undefined) {
    write.stripeSubscriptionId = fields.stripeSubscriptionId;
  }
  if (fields.stripePriceId !== undefined) {
    write.stripePriceId = fields.stripePriceId;
  }
  if (fields.defaultPaymentMethodId !== undefined) {
    write.defaultPaymentMethodId = fields.defaultPaymentMethodId;
  }
  if (fields.payAsYouGoEnabled !== undefined) {
    write.payAsYouGoEnabled = fields.payAsYouGoEnabled;
  }
  if (fields.monthlyCapCents !== undefined) {
    write.monthlyCapCents = fields.monthlyCapCents;
  }
  if (fields.pricePerCreditCents !== undefined) {
    write.pricePerCreditCents = fields.pricePerCreditCents;
  }
  if (fields.billingStatus !== undefined) {
    write.billingStatus = fields.billingStatus;
  }
  if (fields.subscriptionStatus !== undefined) {
    write.subscriptionStatus = fields.subscriptionStatus;
  }
  if (fields.subscriptionUsageLimitsSetupId !== undefined) {
    write.subscriptionUsageLimitsSetupId = fields.subscriptionUsageLimitsSetupId;
  }
  if (fields.subscriptionUserGroupId !== undefined) {
    write.subscriptionUserGroupId = fields.subscriptionUserGroupId;
  }
  if (fields.subscriptionCurrentPeriodEnd !== undefined) {
    write.subscriptionCurrentPeriodEnd = fields.subscriptionCurrentPeriodEnd;
  }
  if (fields.cancelAtPeriodEnd !== undefined) {
    write.cancelAtPeriodEnd = fields.cancelAtPeriodEnd;
  }

  return write;
}

export async function getBillingConfig(): Promise<IBillingConfig> {
  const snapshot = await billingConfigRef().get();
  const data = snapshot.data() ?? {};
  const pricePerCreditCents =
    typeof data.pricePerCreditCents === 'number' && data.pricePerCreditCents > 0
      ? data.pricePerCreditCents
      : DEFAULT_PRICE_PER_CREDIT_CENTS;

  return {
    pricePerCreditCents,
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : undefined,
  };
}

function parseSubscriptionPlan(
  id: string,
  data: FirebaseFirestore.DocumentData,
): ISubscriptionPlanSummary | null {
  const name = typeof data.name === 'string' ? data.name.trim() : '';
  const monthlyCreditAllowance =
    typeof data.monthlyCreditAllowance === 'number'
      ? data.monthlyCreditAllowance
      : NaN;
  const storageLimitBytes = parseOptionalPositiveInteger(data.storageLimitBytes);
  const dailySlideDeckLimit = parseOptionalPositiveInteger(data.dailySlideDeckLimit);
  const monthlyPriceCents = parseOptionalPositiveInteger(data.monthlyPriceCents);
  const isFreePlan = data.isFreePlan === true;
  const stripePriceId = parseOptionalNonEmptyString(data.stripePriceId);

  if (
    !name ||
    !Number.isFinite(monthlyCreditAllowance) ||
    monthlyCreditAllowance < 0 ||
    storageLimitBytes === undefined ||
    dailySlideDeckLimit === undefined
  ) {
    return null;
  }

  if (!isFreePlan && (!stripePriceId || !monthlyPriceCents || monthlyPriceCents <= 0)) {
    return null;
  }

  return {
    usageLimitsSetupId: id,
    name,
    description: typeof data.description === 'string' ? data.description : undefined,
    monthlyCreditAllowance,
    storageLimitBytes,
    dailySlideDeckLimit,
    monthlyPriceCents: isFreePlan ? 0 : monthlyPriceCents ?? 0,
    stripePriceId,
    isFreePlan,
    displayOrder: parseOptionalPositiveInteger(data.displayOrder) ?? 0,
  };
}

export async function listPublicSubscriptionPlans(): Promise<ISubscriptionPlanSummary[]> {
  const collection = getFirestore().collection(USAGE_LIMITS_SETUPS_COLLECTION);
  const [publicSnapshot, freeSnapshot] = await Promise.all([
    collection.where('isPublicPlan', '==', true).get(),
    collection.where('isFreePlan', '==', true).get(),
  ]);
  const plansById = new Map<string, ISubscriptionPlanSummary>();

  for (const doc of [...publicSnapshot.docs, ...freeSnapshot.docs]) {
    if (plansById.has(doc.id)) {
      continue;
    }

    const plan = parseSubscriptionPlan(doc.id, doc.data());
    if (plan) {
      plansById.set(doc.id, plan);
    }
  }

  return Array.from(plansById.values()).sort(
    (a, b) => a.displayOrder - b.displayOrder || a.monthlyPriceCents - b.monthlyPriceCents,
  );
}

async function getSubscriptionPlanBySetupId(
  usageLimitsSetupId: string,
): Promise<ISubscriptionPlanSummary> {
  const snapshot = await getFirestore()
    .collection(USAGE_LIMITS_SETUPS_COLLECTION)
    .doc(usageLimitsSetupId)
    .get();
  const data = snapshot.data() ?? {};
  if (data.isPublicPlan !== true) {
    throw new BillingError('Selected paid plan is not available.', 'BILLING_NOT_READY');
  }
  const plan = snapshot.exists
    ? parseSubscriptionPlan(snapshot.id, data)
    : null;

  if (!plan || plan.isFreePlan || !plan.stripePriceId) {
    throw new BillingError('Selected paid plan is not available.', 'BILLING_NOT_READY');
  }

  return plan;
}

async function getSubscriptionPlanByStripePriceId(
  stripePriceId: string,
): Promise<ISubscriptionPlanSummary> {
  const snapshot = await getFirestore()
    .collection(USAGE_LIMITS_SETUPS_COLLECTION)
    .where('stripePriceId', '==', stripePriceId)
    .limit(1)
    .get();
  const doc = snapshot.docs[0];
  const plan = doc ? parseSubscriptionPlan(doc.id, doc.data()) : null;

  if (!plan) {
    throw new BillingError('Stripe price is not mapped to a StudyForge plan.', 'BILLING_NOT_READY');
  }

  return plan;
}

async function getUserGroupForUsageLimitsSetup(
  usageLimitsSetupId: string,
): Promise<string> {
  const snapshot = await getFirestore()
    .collection(USER_GROUPS_COLLECTION)
    .where('usageLimitsSetupId', '==', usageLimitsSetupId)
    .limit(2)
    .get();

  if (snapshot.empty) {
    throw new BillingError('No user group is mapped to this plan.', 'BILLING_NOT_READY');
  }

  if (snapshot.size > 1) {
    throw new BillingError('More than one user group is mapped to this plan.', 'BILLING_NOT_READY');
  }

  const group = snapshot.docs[0];
  if (!group) {
    throw new BillingError('No user group is mapped to this plan.', 'BILLING_NOT_READY');
  }

  return group.id;
}

async function getDefaultRegistrationGroupId(): Promise<string> {
  const snapshot = await getFirestore()
    .collection(USER_GROUPS_COLLECTION)
    .where('isDefaultRegistrationGroup', '==', true)
    .limit(2)
    .get();

  if (snapshot.empty) {
    throw new BillingError('Default Free user group is not configured.', 'BILLING_NOT_READY');
  }

  if (snapshot.size > 1) {
    throw new BillingError('More than one default Free user group is configured.', 'BILLING_NOT_READY');
  }

  const group = snapshot.docs[0];
  if (!group) {
    throw new BillingError('Default Free user group is not configured.', 'BILLING_NOT_READY');
  }

  return group.id;
}

async function assignUserGroup(userId: string, userGroupId: string): Promise<void> {
  await getFirestore().collection(USERS_COLLECTION).doc(userId).set(
    {
      userGroupId,
      updatedAt: new Date().toISOString(),
      updatedBy: 'stripe-billing',
    },
    { merge: true },
  );
}

export async function getUserBillingState(userId: string): Promise<IUserBillingState> {
  const config = await getBillingConfig();
  const snapshot = await billingStateRef(userId).get();
  return parseUserBillingState(snapshot.data(), {
    defaultPricePerCreditCents: config.pricePerCreditCents,
  });
}

export function buildUsageBillingContext(
  billing: IUserBillingState,
  periodData: FirebaseFirestore.DocumentData,
): IUsageBillingContext {
  const overageAmountCents =
    typeof periodData.overageAmountCents === 'number' ? periodData.overageAmountCents : 0;
  const reservedOverageAmountCents =
    typeof periodData.reservedOverageAmountCents === 'number'
      ? periodData.reservedOverageAmountCents
      : 0;

  return {
    payAsYouGoEnabled: billing.payAsYouGoEnabled && billing.billingStatus === 'active',
    hasPaymentMethod: Boolean(billing.defaultPaymentMethodId),
    monthlyCapCents: billing.monthlyCapCents,
    pricePerCreditCents: billing.pricePerCreditCents,
    overageAmountCents,
    reservedOverageAmountCents,
  };
}

export function buildPayAsYouGoSummary(
  billing: IUserBillingState,
  periodData: FirebaseFirestore.DocumentData,
): IUsagePayAsYouGoSummary {
  const overageAmountCents =
    typeof periodData.overageAmountCents === 'number' ? periodData.overageAmountCents : 0;
  const reservedOverageAmountCents =
    typeof periodData.reservedOverageAmountCents === 'number'
      ? periodData.reservedOverageAmountCents
      : 0;
  const spentOverageCredits =
    typeof periodData.spentOverageCredits === 'number' ? periodData.spentOverageCredits : 0;
  const reservedOverageCredits =
    typeof periodData.reservedOverageCredits === 'number' ? periodData.reservedOverageCredits : 0;

  return {
    enabled: billing.payAsYouGoEnabled && billing.billingStatus === 'active',
    monthlyCapCents: billing.monthlyCapCents,
    remainingCapCents: calculateRemainingOverageCapCents({
      monthlyCapCents: billing.monthlyCapCents,
      overageAmountCents,
      reservedOverageAmountCents,
    }),
    spentOverageAmountCents: overageAmountCents,
    reservedOverageAmountCents,
    spentOverageCredits,
    reservedOverageCredits,
    pricePerCreditCents: billing.pricePerCreditCents,
    billingStatus: billing.billingStatus,
    hasPaymentMethod: Boolean(billing.defaultPaymentMethodId),
  };
}

export class BillingError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'PAYMENT_METHOD_REQUIRED'
      | 'PAY_AS_YOU_GO_DISABLED'
      | 'INVALID_CAP'
      | 'STRIPE_NOT_CONFIGURED'
      | 'BILLING_NOT_READY',
  ) {
    super(message);
    this.name = 'BillingError';
  }
}

function getStripeClient(secretKey: string): Stripe {
  return new Stripe(secretKey);
}

export async function createBillingCheckoutSession(params: {
  userId: string;
  email?: string;
  usageLimitsSetupId: string;
  successUrl: string;
  cancelUrl: string;
  stripeSecretKey: string;
}): Promise<string> {
  const stripe = getStripeClient(params.stripeSecretKey);
  const billing = await getUserBillingState(params.userId);
  const plan = await getSubscriptionPlanBySetupId(params.usageLimitsSetupId);
  const stripePriceId = plan.stripePriceId;
  if (!stripePriceId) {
    throw new BillingError('Selected paid plan is not available.', 'BILLING_NOT_READY');
  }

  let customerId = billing.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create(
      {
        email: params.email,
        metadata: { userId: params.userId },
      },
      { idempotencyKey: `billing-customer:${params.userId}` },
    );
    customerId = customer.id;
    await billingStateRef(params.userId).set(
      buildBillingStateWrite({
        stripeCustomerId: customerId,
        billingStatus: 'payment_method_required',
        payAsYouGoEnabled: false,
        monthlyCapCents: billing.monthlyCapCents,
        pricePerCreditCents: billing.pricePerCreditCents,
          subscriptionStatus: 'none',
      }),
      { merge: true },
    );
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    line_items: [
      {
        price: stripePriceId,
        quantity: 1,
      },
    ],
    allow_promotion_codes: true,
    metadata: {
      userId: params.userId,
      usageLimitsSetupId: plan.usageLimitsSetupId,
    },
    subscription_data: {
      metadata: {
        userId: params.userId,
        usageLimitsSetupId: plan.usageLimitsSetupId,
        stripePriceId,
      },
    },
  });

  if (!session.url) {
    throw new BillingError('Failed to create Stripe checkout session.', 'STRIPE_NOT_CONFIGURED');
  }

  return session.url;
}

export async function createBillingPortalSession(params: {
  userId: string;
  returnUrl: string;
  stripeSecretKey: string;
}): Promise<string> {
  const stripe = getStripeClient(params.stripeSecretKey);
  const billing = await getUserBillingState(params.userId);

  if (!billing.stripeCustomerId) {
    throw new BillingError('Billing is not set up yet.', 'BILLING_NOT_READY');
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: billing.stripeCustomerId,
    return_url: params.returnUrl,
  });

  return session.url;
}

export async function updatePayAsYouGoSettings(
  userId: string,
  request: IUpdatePayAsYouGoSettingsRequest,
): Promise<IUserBillingState> {
  if (!Number.isFinite(request.monthlyCapCents) || request.monthlyCapCents <= 0) {
    throw new BillingError('Monthly cap must be greater than zero.', 'INVALID_CAP');
  }

  const billing = await getUserBillingState(userId);

  if (request.enabled) {
    if (!billing.defaultPaymentMethodId) {
      throw new BillingError('Add a payment method before enabling pay-as-you-go.', 'PAYMENT_METHOD_REQUIRED');
    }
    if (billing.billingStatus !== 'active') {
      throw new BillingError('Billing is not active yet.', 'BILLING_NOT_READY');
    }
  }

  const write = buildBillingStateWrite({
    payAsYouGoEnabled: request.enabled,
    monthlyCapCents: Math.floor(request.monthlyCapCents),
    pricePerCreditCents: billing.pricePerCreditCents,
    billingStatus: billing.billingStatus,
    ...(billing.stripeCustomerId ? { stripeCustomerId: billing.stripeCustomerId } : {}),
    ...(billing.defaultPaymentMethodId
      ? { defaultPaymentMethodId: billing.defaultPaymentMethodId }
      : {}),
  });

  await billingStateRef(userId).set(write, { merge: true });
  await syncUsageSummaryAfterBillingChange(userId);

  return {
    ...billing,
    payAsYouGoEnabled: request.enabled,
    monthlyCapCents: Math.floor(request.monthlyCapCents),
    updatedAt: typeof write.updatedAt === 'string' ? write.updatedAt : new Date().toISOString(),
  };
}

function paymentMethodIdFromUnknown(value: unknown): string | undefined {
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }
  if (isRecord(value) && typeof value.id === 'string' && value.id.length > 0) {
    return value.id;
  }
  return undefined;
}

async function resolveDefaultPaymentMethodId(
  stripe: Stripe,
  customerId: string,
): Promise<string | undefined> {
  const customer = await stripe.customers.retrieve(customerId);
  if (!isActiveStripeCustomer(customer)) {
    return undefined;
  }

  const fromInvoiceSettings = paymentMethodIdFromUnknown(
    customer.invoice_settings?.default_payment_method,
  );
  if (fromInvoiceSettings) {
    return fromInvoiceSettings;
  }

  const paymentMethods = await stripe.paymentMethods.list({
    customer: customerId,
    type: 'card',
    limit: 1,
  });
  return paymentMethods.data[0]?.id;
}

async function ensureCustomerDefaultPaymentMethod(
  stripe: Stripe,
  customerId: string,
  paymentMethodId: string,
): Promise<void> {
  await stripe.customers.update(customerId, {
    invoice_settings: {
      default_payment_method: paymentMethodId,
    },
  });
}

const STRIPE_SUBSCRIPTION_STATUS_SET = new Set<string>([
  'incomplete',
  'trialing',
  'active',
  'past_due',
  'canceled',
  'unpaid',
  'paused',
]);

function isMappedSubscriptionStatus(status: string): status is SubscriptionStatus {
  return STRIPE_SUBSCRIPTION_STATUS_SET.has(status);
}

function mapStripeSubscriptionStatus(
  status: Stripe.Subscription.Status,
): SubscriptionStatus {
  if (isMappedSubscriptionStatus(status)) {
    return status;
  }
  return 'none';
}

function shouldAssignPaidPlan(status: SubscriptionStatus): boolean {
  return status === 'active' || status === 'trialing' || status === 'past_due';
}

function shouldFallbackToFreePlan(status: SubscriptionStatus): boolean {
  return status === 'canceled' || status === 'unpaid' || status === 'none';
}

function readCurrentPeriodEndSeconds(value: unknown): number | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }

  const periodEnd = Reflect.get(value, 'current_period_end');
  return typeof periodEnd === 'number' && periodEnd > 0 ? periodEnd : undefined;
}

function subscriptionCurrentPeriodEnd(
  subscription: Stripe.Subscription,
): string | undefined {
  const seconds = subscription.items.data
    .map((item) => readCurrentPeriodEndSeconds(item))
    .find((value): value is number => typeof value === 'number');

  if (seconds === undefined) {
    return undefined;
  }

  return new Date(seconds * 1000).toISOString();
}

function subscriptionCustomerId(subscription: Stripe.Subscription): string | undefined {
  if (typeof subscription.customer === 'string') {
    return subscription.customer;
  }
  return subscription.customer.id;
}

function subscriptionPriceId(subscription: Stripe.Subscription): string | undefined {
  return subscription.items.data[0]?.price.id;
}

async function syncUserSubscription(params: {
  subscription: Stripe.Subscription;
  defaultPaymentMethodId?: string;
}): Promise<void> {
  const userId = params.subscription.metadata.userId;
  const customerId = subscriptionCustomerId(params.subscription);
  if (!userId || !customerId) {
    return;
  }

  const subscriptionStatus = mapStripeSubscriptionStatus(params.subscription.status);
  const currentPeriodEnd = subscriptionCurrentPeriodEnd(params.subscription);
  const billing = await getUserBillingState(userId);

  if (shouldFallbackToFreePlan(subscriptionStatus)) {
    const freeGroupId = await getDefaultRegistrationGroupId();
    await assignUserGroup(userId, freeGroupId);
    await billingStateRef(userId).set(
      buildBillingStateWrite({
        stripeCustomerId: customerId,
        stripeSubscriptionId: params.subscription.id,
        billingStatus: subscriptionStatus === 'unpaid' ? 'past_due' : 'none',
        subscriptionStatus,
        subscriptionCurrentPeriodEnd: currentPeriodEnd,
        cancelAtPeriodEnd: false,
        payAsYouGoEnabled: false,
        monthlyCapCents: billing.monthlyCapCents,
        pricePerCreditCents: billing.pricePerCreditCents,
      }),
      { merge: true },
    );
    await syncUsageSummaryAfterBillingChange(userId);
    return;
  }

  const stripePriceId = subscriptionPriceId(params.subscription);
  if (!stripePriceId) {
    return;
  }

  const plan = await getSubscriptionPlanByStripePriceId(stripePriceId);
  const userGroupId = await getUserGroupForUsageLimitsSetup(plan.usageLimitsSetupId);
  if (shouldAssignPaidPlan(subscriptionStatus)) {
    await assignUserGroup(userId, userGroupId);
  }
  await billingStateRef(userId).set(
    buildBillingStateWrite({
      stripeCustomerId: customerId,
      stripeSubscriptionId: params.subscription.id,
      stripePriceId,
      ...(params.defaultPaymentMethodId
        ? { defaultPaymentMethodId: params.defaultPaymentMethodId }
        : {}),
      billingStatus: shouldAssignPaidPlan(subscriptionStatus)
        ? subscriptionStatus === 'past_due'
          ? 'past_due'
          : 'active'
        : billing.billingStatus,
      subscriptionStatus,
      subscriptionUsageLimitsSetupId: shouldAssignPaidPlan(subscriptionStatus)
        ? plan.usageLimitsSetupId
        : billing.subscriptionUsageLimitsSetupId,
      subscriptionUserGroupId: shouldAssignPaidPlan(subscriptionStatus)
        ? userGroupId
        : billing.subscriptionUserGroupId,
      subscriptionCurrentPeriodEnd: currentPeriodEnd,
      cancelAtPeriodEnd: params.subscription.cancel_at_period_end === true,
      payAsYouGoEnabled: billing.payAsYouGoEnabled,
      monthlyCapCents: billing.monthlyCapCents,
      pricePerCreditCents: billing.pricePerCreditCents,
    }),
    { merge: true },
  );
  await syncUsageSummaryAfterBillingChange(userId);
}

async function syncUsageSummaryAfterBillingChange(userId: string): Promise<void> {
  const { getUserUsageSummary } = await import('./usage-limits-service');
  await getUserUsageSummary(userId);
}

export async function handleStripeBillingWebhook(params: {
  rawBody: Buffer;
  signature: string;
  stripeSecretKey: string;
  stripeWebhookSecret: string;
}): Promise<void> {
  const stripe = getStripeClient(params.stripeSecretKey);
  const event = stripe.webhooks.constructEvent(
    params.rawBody,
    params.signature,
    params.stripeWebhookSecret,
  );

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const userId = session.metadata?.userId;
      const customerId =
        typeof session.customer === 'string' ? session.customer : session.customer?.id;
      const subscriptionId =
        typeof session.subscription === 'string'
          ? session.subscription
          : session.subscription?.id;

      if (!userId || !customerId || !subscriptionId) {
        return;
      }

      const defaultPaymentMethodId = await resolveDefaultPaymentMethodId(stripe, customerId);

      if (defaultPaymentMethodId) {
        await ensureCustomerDefaultPaymentMethod(stripe, customerId, defaultPaymentMethodId);
      }

      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      await syncUserSubscription({ subscription, defaultPaymentMethodId });
      break;
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const subscription = event.data.object;
      await syncUserSubscription({ subscription });
      break;
    }
    case 'customer.updated': {
      const customer = event.data.object;
      const userId = customer.metadata?.userId;
      if (!userId) {
        return;
      }

      const defaultPaymentMethodId = await resolveDefaultPaymentMethodId(stripe, customer.id);
      const billing = await getUserBillingState(userId);
      const write = buildBillingStateWrite({
        billingStatus: defaultPaymentMethodId ? 'active' : 'payment_method_required',
        payAsYouGoEnabled: defaultPaymentMethodId ? billing.payAsYouGoEnabled : false,
      });
      if (defaultPaymentMethodId) {
        write.defaultPaymentMethodId = defaultPaymentMethodId;
        await ensureCustomerDefaultPaymentMethod(stripe, customer.id, defaultPaymentMethodId);
      } else {
        write.defaultPaymentMethodId = FieldValue.delete();
      }
      await billingStateRef(userId).set(write, { merge: true });
      await syncUsageSummaryAfterBillingChange(userId);
      break;
    }
    case 'invoice.payment_failed': {
      const invoice = event.data.object;
      const customerId =
        typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
      if (!customerId) {
        return;
      }

      const customer = await stripe.customers.retrieve(customerId);
      if (!isActiveStripeCustomer(customer)) {
        return;
      }

      const userId = customer.metadata?.userId;
      if (!userId) {
        return;
      }

      await billingStateRef(userId).set(
        buildBillingStateWrite({
          billingStatus: 'past_due',
          subscriptionStatus: 'past_due',
          payAsYouGoEnabled: false,
        }),
        { merge: true },
      );
      await syncUsageSummaryAfterBillingChange(userId);
      break;
    }
    case 'invoice.paid': {
      // Period invoiced amounts are recorded when the invoice is finalized.
      break;
    }
    default:
      break;
  }
}

async function createAndCollectOverageInvoice(params: {
  stripe: Stripe;
  customerId: string;
  amountCents: number;
  periodKey: string;
  userId: string;
  idempotencyBase: string;
}): Promise<{ invoiceId: string; amountPaidCents: number }> {
  const invoice = await params.stripe.invoices.create(
    {
      customer: params.customerId,
      auto_advance: false,
      collection_method: 'charge_automatically',
      pending_invoice_items_behavior: 'exclude',
      metadata: {
        userId: params.userId,
        usagePeriodKey: params.periodKey,
        invoicedAmountCents: String(params.amountCents),
      },
    },
    { idempotencyKey: `${params.idempotencyBase}:invoice` },
  );

  await params.stripe.invoices.addLines(
    invoice.id,
    {
      lines: [
        {
          amount: params.amountCents,
          description: `StudyForge pay-as-you-go overage for ${params.periodKey}`,
        },
      ],
    },
    { idempotencyKey: `${params.idempotencyBase}:lines` },
  );

  let collected = await params.stripe.invoices.finalizeInvoice(invoice.id);
  if (collected.total <= 0) {
    throw new Error(
      `Overage invoice ${invoice.id} finalized with total ${collected.total}; expected ${params.amountCents}.`,
    );
  }

  if (collected.status !== 'paid') {
    collected = await params.stripe.invoices.pay(invoice.id);
  }

  if (collected.status !== 'paid' || collected.amount_paid <= 0) {
    throw new Error(
      `Overage invoice ${invoice.id} was not paid (status=${collected.status}, amount_paid=${collected.amount_paid}).`,
    );
  }

  return {
    invoiceId: collected.id,
    amountPaidCents: collected.amount_paid,
  };
}

export async function processMonthlyOverageInvoices(stripeSecretKey: string): Promise<number> {
  const stripe = getStripeClient(stripeSecretKey);
  const PAGE_SIZE = 100;
  let invoicedCount = 0;
  let lastUserDoc: FirebaseFirestore.QueryDocumentSnapshot | undefined;

  while (true) {
    let usersQuery = getFirestore().collection(USERS_COLLECTION).select().limit(PAGE_SIZE);
    if (lastUserDoc) {
      usersQuery = usersQuery.startAfter(lastUserDoc);
    }

    const usersSnapshot = await usersQuery.get();
    if (usersSnapshot.empty) {
      break;
    }

    for (const userDoc of usersSnapshot.docs) {
      const billingSnapshot = await billingStateRef(userDoc.id).get();
      const billingConfig = await getBillingConfig();
      const billing = parseUserBillingState(billingSnapshot.data(), {
        defaultPricePerCreditCents: billingConfig.pricePerCreditCents,
      });
      const customerId = billing.stripeCustomerId;
      if (!customerId || billing.billingStatus !== 'active') {
        continue;
      }

      const periodsSnapshot = await userDoc.ref.collection('usagePeriods').get();
      for (const periodDoc of periodsSnapshot.docs) {
        const periodData = periodDoc.data();
        const overageAmountCents =
          typeof periodData.overageAmountCents === 'number' ? periodData.overageAmountCents : 0;
        const invoicedOverageAmountCents =
          typeof periodData.invoicedOverageAmountCents === 'number'
            ? periodData.invoicedOverageAmountCents
            : 0;
        const uninvoicedAmount = overageAmountCents - invoicedOverageAmountCents;

        if (uninvoicedAmount <= 0) {
          continue;
        }

        const invoiceAmountCents = roundInvoiceAmountCents(uninvoicedAmount);
        if (invoiceAmountCents <= 0) {
          continue;
        }

        const idempotencyBase = `overage:v2:${userDoc.id}:${periodDoc.id}:${invoicedOverageAmountCents}`;

        const invoice = await createAndCollectOverageInvoice({
          stripe,
          customerId,
          amountCents: invoiceAmountCents,
          periodKey: periodDoc.id,
          userId: userDoc.id,
          idempotencyBase,
        });

        await usagePeriodRef(userDoc.id, periodDoc.id).set(
          {
            invoicedOverageAmountCents: invoicedOverageAmountCents + invoice.amountPaidCents,
            updatedAt: new Date().toISOString(),
          },
          { merge: true },
        );

        invoicedCount += 1;
      }
    }

    if (usersSnapshot.docs.length < PAGE_SIZE) {
      break;
    }
    lastUserDoc = usersSnapshot.docs[usersSnapshot.docs.length - 1];
  }

  return invoicedCount;
}
