import {
  calculateRemainingOverageCapCents,
  DEFAULT_PAYG_MONTHLY_CAP_CENTS,
  DEFAULT_PRICE_PER_CREDIT_CENTS,
  type BillingStatus,
  type IBillingConfig,
  type IUpdatePayAsYouGoSettingsRequest,
  type IUserBillingState,
} from '@shared-types';
import { getFirestore } from 'firebase-admin/firestore';
import Stripe from 'stripe';
import type { IUsageBillingContext } from './usage-limits-logic';

const USERS_COLLECTION = 'users';
const BILLING_CONFIG_COLLECTION = 'billingConfig';
const BILLING_CONFIG_DOC_ID = 'global';
const BILLING_STATE_DOC_ID = 'current';

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

export function parseUserBillingState(data: FirebaseFirestore.DocumentData | undefined): IUserBillingState {
  const record = data ?? {};
  const pricePerCreditCents =
    typeof record.pricePerCreditCents === 'number' && record.pricePerCreditCents > 0
      ? record.pricePerCreditCents
      : DEFAULT_PRICE_PER_CREDIT_CENTS;

  return {
    stripeCustomerId:
      typeof record.stripeCustomerId === 'string' ? record.stripeCustomerId : undefined,
    defaultPaymentMethodId:
      typeof record.defaultPaymentMethodId === 'string'
        ? record.defaultPaymentMethodId
        : undefined,
    payAsYouGoEnabled: record.payAsYouGoEnabled === true,
    monthlyCapCents:
      typeof record.monthlyCapCents === 'number' && record.monthlyCapCents > 0
        ? record.monthlyCapCents
        : DEFAULT_PAYG_MONTHLY_CAP_CENTS,
    pricePerCreditCents,
    billingStatus: parseBillingStatus(record.billingStatus),
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : undefined,
  };
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

export async function getUserBillingState(userId: string): Promise<IUserBillingState> {
  const config = await getBillingConfig();
  const snapshot = await billingStateRef(userId).get();
  const state = parseUserBillingState(snapshot.data());

  return {
    ...state,
    pricePerCreditCents: state.pricePerCreditCents || config.pricePerCreditCents,
  };
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
) {
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
  return new Stripe(secretKey, {
    apiVersion: '2025-02-24.acacia',
  });
}

export async function createBillingCheckoutSession(params: {
  userId: string;
  email?: string;
  successUrl: string;
  cancelUrl: string;
  stripeSecretKey: string;
}): Promise<string> {
  const stripe = getStripeClient(params.stripeSecretKey);
  const billing = await getUserBillingState(params.userId);

  let customerId = billing.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: params.email,
      metadata: { userId: params.userId },
    });
    customerId = customer.id;
    await billingStateRef(params.userId).set(
      {
        stripeCustomerId: customerId,
        billingStatus: 'payment_method_required',
        payAsYouGoEnabled: false,
        monthlyCapCents: billing.monthlyCapCents,
        pricePerCreditCents: billing.pricePerCreditCents,
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'setup',
    customer: customerId,
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    payment_method_types: ['card'],
    metadata: { userId: params.userId },
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

  const now = new Date().toISOString();
  const nextState: IUserBillingState = {
    ...billing,
    payAsYouGoEnabled: request.enabled,
    monthlyCapCents: Math.floor(request.monthlyCapCents),
    updatedAt: now,
  };

  await billingStateRef(userId).set(nextState, { merge: true });
  return nextState;
}

async function resolveDefaultPaymentMethodId(
  stripe: Stripe,
  customerId: string,
): Promise<string | undefined> {
  const customer = await stripe.customers.retrieve(customerId);
  if (!isRecord(customer) || customer.deleted) {
    return undefined;
  }

  const defaultPaymentMethod = customer.invoice_settings?.default_payment_method;
  if (typeof defaultPaymentMethod === 'string') {
    return defaultPaymentMethod;
  }
  if (isRecord(defaultPaymentMethod) && typeof defaultPaymentMethod.id === 'string') {
    return defaultPaymentMethod.id;
  }

  return undefined;
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
      const setupIntentId =
        typeof session.setup_intent === 'string'
          ? session.setup_intent
          : session.setup_intent?.id;

      if (!userId || !customerId) {
        return;
      }

      let defaultPaymentMethodId: string | undefined;
      if (setupIntentId) {
        const setupIntent = await stripe.setupIntents.retrieve(setupIntentId);
        if (typeof setupIntent.payment_method === 'string') {
          defaultPaymentMethodId = setupIntent.payment_method;
        }
      }

      if (!defaultPaymentMethodId) {
        defaultPaymentMethodId = await resolveDefaultPaymentMethodId(stripe, customerId);
      }

      const billing = await getUserBillingState(userId);
      await billingStateRef(userId).set(
        {
          stripeCustomerId: customerId,
          defaultPaymentMethodId,
          billingStatus: defaultPaymentMethodId ? 'active' : 'payment_method_required',
          payAsYouGoEnabled: billing.payAsYouGoEnabled,
          monthlyCapCents: billing.monthlyCapCents,
          pricePerCreditCents: billing.pricePerCreditCents,
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      );
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
      await billingStateRef(userId).set(
        {
          defaultPaymentMethodId,
          billingStatus: defaultPaymentMethodId ? 'active' : 'payment_method_required',
          payAsYouGoEnabled: defaultPaymentMethodId ? billing.payAsYouGoEnabled : false,
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      );
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
      if (!isRecord(customer) || customer.deleted) {
        return;
      }

      const userId = customer.metadata?.userId;
      if (!userId) {
        return;
      }

      await billingStateRef(userId).set(
        {
          billingStatus: 'past_due',
          payAsYouGoEnabled: false,
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      );
      break;
    }
    case 'invoice.paid': {
      const invoice = event.data.object;
      const periodKey = invoice.metadata?.usagePeriodKey;
      const userId = invoice.metadata?.userId;
      if (!periodKey || !userId) {
        return;
      }

      const periodRef = getFirestore()
        .collection(USERS_COLLECTION)
        .doc(userId)
        .collection('usagePeriods')
        .doc(periodKey);

      const periodSnapshot = await periodRef.get();
      const periodData = periodSnapshot.data() ?? {};
      const overageAmountCents =
        typeof periodData.overageAmountCents === 'number' ? periodData.overageAmountCents : 0;

      await periodRef.set(
        {
          invoicedOverageAmountCents: overageAmountCents,
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      );
      break;
    }
    default:
      break;
  }
}

export async function processMonthlyOverageInvoices(stripeSecretKey: string): Promise<number> {
  const stripe = getStripeClient(stripeSecretKey);
  const usersSnapshot = await getFirestore().collection(USERS_COLLECTION).select().get();
  let invoicedCount = 0;

  for (const userDoc of usersSnapshot.docs) {
    const billingSnapshot = await billingStateRef(userDoc.id).get();
    const billing = parseUserBillingState(billingSnapshot.data());
    if (!billing.stripeCustomerId || billing.billingStatus !== 'active') {
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

      await stripe.invoiceItems.create({
        customer: billing.stripeCustomerId,
        amount: uninvoicedAmount,
        currency: 'usd',
        description: `StudyForge pay-as-you-go overage for ${periodDoc.id}`,
      });

      const invoice = await stripe.invoices.create({
        customer: billing.stripeCustomerId,
        auto_advance: true,
        metadata: {
          userId: userDoc.id,
          usagePeriodKey: periodDoc.id,
        },
      });

      await stripe.invoices.finalizeInvoice(invoice.id);
      invoicedCount += 1;
    }
  }

  return invoicedCount;
}
