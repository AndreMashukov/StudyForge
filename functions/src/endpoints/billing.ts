import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { defineSecret } from 'firebase-functions/params';
import { z } from 'zod';
import { validateVerifiedAuth } from '@study-forge/backend-core/lib/auth';
import { throwCallableError } from '@study-forge/backend-core/lib/callable-error';
import {
  BillingError,
  createBillingCheckoutSession,
  createBillingPortalSession,
  getUserBillingState,
  handleStripeBillingWebhook,
  listPublicSubscriptionPlans,
  updatePayAsYouGoSettings,
} from '@study-forge/backend-core/services/billing-service';
import { getUserUsageSummary } from '@study-forge/backend-core/services/usage-limits-service';
import {
  DEFAULT_BILLING_REDIRECT_ORIGINS,
  type ApiResponse,
  type ICreateBillingCheckoutSessionResponse,
  type ICreateBillingPortalSessionResponse,
  type ISubscriptionPlanSummary,
  type IUserBillingState,
  type IUserUsageSummary,
} from '@shared-types';

const stripeSecretKey = defineSecret('STRIPE_SECRET_KEY');
const stripeWebhookSecret = defineSecret('STRIPE_WEBHOOK_SECRET');

const billingOriginRequestSchema = z.object({
  origin: z.string().url(),
  usageLimitsSetupId: z.string().trim().min(1).optional(),
});

const updatePayAsYouGoSettingsRequestSchema = z.object({
  enabled: z.boolean(),
  monthlyCapCents: z.number().int().positive(),
});

function getAllowedBillingOrigins(): Set<string> {
  const extraOrigins =
    process.env.BILLING_ALLOWED_ORIGINS?.split(',')
      .map((origin) => origin.trim().replace(/\/$/, ''))
      .filter(Boolean) ?? [];

  return new Set([...DEFAULT_BILLING_REDIRECT_ORIGINS, ...extraOrigins]);
}

function resolveAppOrigin(requestData: unknown): string {
  const parsed = billingOriginRequestSchema.safeParse(requestData);
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', 'A valid billing redirect origin is required.');
  }

  const origin = parsed.data.origin.replace(/\/$/, '');
  if (!getAllowedBillingOrigins().has(origin)) {
    throw new HttpsError('invalid-argument', 'Origin is not allowed for billing redirects.');
  }

  return origin;
}

function resolveCheckoutRequest(requestData: unknown): {
  origin: string;
  usageLimitsSetupId: string;
} {
  const parsed = billingOriginRequestSchema.safeParse(requestData);
  if (!parsed.success || !parsed.data.usageLimitsSetupId) {
    throw new HttpsError('invalid-argument', 'A valid billing plan is required.');
  }

  return {
    origin: resolveAppOrigin(requestData),
    usageLimitsSetupId: parsed.data.usageLimitsSetupId,
  };
}

function throwBillingError(error: BillingError): never {
  const code =
    error.code === 'INVALID_CAP' || error.code === 'PAY_AS_YOU_GO_DISABLED'
      ? 'invalid-argument'
      : error.code === 'PAYMENT_METHOD_REQUIRED' || error.code === 'BILLING_NOT_READY'
        ? 'failed-precondition'
        : 'internal';

  throw new HttpsError(code, error.message, { code: error.code });
}

export const createBillingCheckoutSessionEndpoint = onCall(
  {
    region: 'asia-east1',
    cors: true,
    secrets: [stripeSecretKey],
  },
  async (request): Promise<ApiResponse<ICreateBillingCheckoutSessionResponse>> => {
    try {
      const userId = await validateVerifiedAuth(request);
      const { origin, usageLimitsSetupId } = resolveCheckoutRequest(request.data);
      const checkoutUrl = await createBillingCheckoutSession({
        userId,
        email: request.auth?.token.email,
        usageLimitsSetupId,
        successUrl: `${origin}/usage?billing=success`,
        cancelUrl: `${origin}/usage?billing=cancelled`,
        stripeSecretKey: stripeSecretKey.value(),
      });

      return {
        success: true,
        data: { checkoutUrl },
      };
    } catch (error) {
      if (error instanceof BillingError) {
        throwBillingError(error);
      }
      throwCallableError(error, 'Failed to create billing checkout session');
    }
  },
);

export const createBillingPortalSessionEndpoint = onCall(
  {
    region: 'asia-east1',
    cors: true,
    secrets: [stripeSecretKey],
  },
  async (request): Promise<ApiResponse<ICreateBillingPortalSessionResponse>> => {
    try {
      const userId = await validateVerifiedAuth(request);
      const origin = resolveAppOrigin(request.data);
      const portalUrl = await createBillingPortalSession({
        userId,
        returnUrl: `${origin}/usage`,
        stripeSecretKey: stripeSecretKey.value(),
      });

      return {
        success: true,
        data: { portalUrl },
      };
    } catch (error) {
      if (error instanceof BillingError) {
        throwBillingError(error);
      }
      throwCallableError(error, 'Failed to create billing portal session');
    }
  },
);

export const listSubscriptionPlansEndpoint = onCall(
  { region: 'asia-east1', cors: true },
  async (): Promise<ApiResponse<ISubscriptionPlanSummary[]>> => {
    try {
      const plans = await listPublicSubscriptionPlans();
      return {
        success: true,
        data: plans,
      };
    } catch (error) {
      throwCallableError(error, 'Failed to load subscription plans');
    }
  },
);

export const updatePayAsYouGoSettingsEndpoint = onCall(
  { region: 'asia-east1', cors: true },
  async (request): Promise<ApiResponse<IUserBillingState>> => {
    try {
      const userId = await validateVerifiedAuth(request);
      const parsed = updatePayAsYouGoSettingsRequestSchema.safeParse(request.data);
      if (!parsed.success) {
        throw new HttpsError('invalid-argument', 'Invalid pay-as-you-go settings payload.');
      }

      const billing = await updatePayAsYouGoSettings(userId, parsed.data);

      return {
        success: true,
        data: billing,
      };
    } catch (error) {
      if (error instanceof BillingError) {
        throwBillingError(error);
      }
      throwCallableError(error, 'Failed to update pay-as-you-go settings');
    }
  },
);

export const getBillingState = onCall(
  { region: 'asia-east1', cors: true },
  async (request): Promise<ApiResponse<IUserBillingState>> => {
    try {
      const userId = await validateVerifiedAuth(request);
      const billing = await getUserBillingState(userId);

      return {
        success: true,
        data: billing,
      };
    } catch (error) {
      throwCallableError(error, 'Failed to load billing state');
    }
  },
);

export const refreshUsageSummary = onCall(
  { region: 'asia-east1', cors: true },
  async (request): Promise<ApiResponse<IUserUsageSummary>> => {
    try {
      const userId = await validateVerifiedAuth(request);
      const summary = await getUserUsageSummary(userId);

      return {
        success: true,
        data: summary,
      };
    } catch (error) {
      throwCallableError(error, 'Failed to refresh usage summary');
    }
  },
);

export const stripeBillingWebhook = onRequest(
  {
    region: 'asia-east1',
    cors: false,
    secrets: [stripeSecretKey, stripeWebhookSecret],
  },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    const signature = req.header('stripe-signature');
    if (!signature) {
      res.status(400).send('Missing Stripe signature');
      return;
    }

    try {
      const rawBody = req.rawBody;
      if (!rawBody || rawBody.length === 0) {
        logger.error('Stripe webhook missing rawBody');
        res.status(400).send('Invalid webhook payload');
        return;
      }

      const webhookSecret = stripeWebhookSecret.value();
      if (!webhookSecret.startsWith('whsec_')) {
        logger.error('STRIPE_WEBHOOK_SECRET is not a Stripe signing secret', {
          prefix: webhookSecret.slice(0, 6),
        });
        res.status(400).send('Webhook misconfigured');
        return;
      }

      await handleStripeBillingWebhook({
        rawBody,
        signature,
        stripeSecretKey: stripeSecretKey.value(),
        stripeWebhookSecret: webhookSecret,
      });
      res.status(200).json({ received: true });
    } catch (error) {
      logger.error('Stripe webhook handling failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(400).send('Webhook error');
    }
  },
);
