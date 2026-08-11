import {
  calculateRemainingOverageCapCents,
  DEFAULT_PAYG_MONTHLY_CAP_CENTS,
  DEFAULT_PRICE_PER_CREDIT_CENTS,
  type BillingStatus,
  type IBillingConfig,
  type IUpdatePayAsYouGoSettingsRequest,
  type IUsagePayAsYouGoSummary,
  type IUserBillingState,
} from '@shared-types';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
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
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : undefined,
  };
}

interface IBillingStateWrite {
  stripeCustomerId?: string;
  defaultPaymentMethodId?: string;
  payAsYouGoEnabled?: boolean;
  monthlyCapCents?: number;
  pricePerCreditCents?: number;
  billingStatus?: BillingStatus;
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
  successUrl: string;
  cancelUrl: string;
  stripeSecretKey: string;
}): Promise<string> {
  const stripe = getStripeClient(params.stripeSecretKey);
  const billing = await getUserBillingState(params.userId);

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
      }),
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
        defaultPaymentMethodId = paymentMethodIdFromUnknown(setupIntent.payment_method);
      }

      if (!defaultPaymentMethodId) {
        defaultPaymentMethodId = await resolveDefaultPaymentMethodId(stripe, customerId);
      }

      if (defaultPaymentMethodId) {
        await ensureCustomerDefaultPaymentMethod(stripe, customerId, defaultPaymentMethodId);
      }

      const billing = await getUserBillingState(userId);
      await billingStateRef(userId).set(
        buildBillingStateWrite({
          stripeCustomerId: customerId,
          ...(defaultPaymentMethodId ? { defaultPaymentMethodId } : {}),
          billingStatus: defaultPaymentMethodId ? 'active' : 'payment_method_required',
          payAsYouGoEnabled: billing.payAsYouGoEnabled,
          monthlyCapCents: billing.monthlyCapCents,
          pricePerCreditCents: billing.pricePerCreditCents,
        }),
        { merge: true },
      );
      await syncUsageSummaryAfterBillingChange(userId);
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

        const idempotencyBase = `overage:${userDoc.id}:${periodDoc.id}:${invoicedOverageAmountCents}`;

        await stripe.invoiceItems.create(
          {
            customer: billing.stripeCustomerId,
            amount: uninvoicedAmount,
            currency: 'usd',
            description: `StudyForge pay-as-you-go overage for ${periodDoc.id}`,
          },
          { idempotencyKey: `${idempotencyBase}:item` },
        );

        const invoice = await stripe.invoices.create(
          {
            customer: billing.stripeCustomerId,
            auto_advance: true,
            metadata: {
              userId: userDoc.id,
              usagePeriodKey: periodDoc.id,
              invoicedAmountCents: String(uninvoicedAmount),
            },
          },
          { idempotencyKey: `${idempotencyBase}:invoice` },
        );

        await stripe.invoices.finalizeInvoice(invoice.id);

        await usagePeriodRef(userDoc.id, periodDoc.id).set(
          {
            invoicedOverageAmountCents: invoicedOverageAmountCents + uninvoicedAmount,
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
