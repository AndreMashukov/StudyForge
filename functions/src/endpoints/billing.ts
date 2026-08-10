import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { validateAuth } from '@study-forge/backend-core/lib/auth';
import { throwCallableError } from '@study-forge/backend-core/lib/callable-error';
import {
  BillingError,
  createBillingCheckoutSession,
  createBillingPortalSession,
  getUserBillingState,
  handleStripeBillingWebhook,
  updatePayAsYouGoSettings,
} from '@study-forge/backend-core/services/billing-service';
import { getUserUsageSummary } from '@study-forge/backend-core/services/usage-limits-service';
import type {
  ApiResponse,
  ICreateBillingCheckoutSessionResponse,
  ICreateBillingPortalSessionResponse,
  IUpdatePayAsYouGoSettingsRequest,
  IUserBillingState,
  IUserUsageSummary,
} from '@shared-types';

const stripeSecretKey = defineSecret('STRIPE_SECRET_KEY');
const stripeWebhookSecret = defineSecret('STRIPE_WEBHOOK_SECRET');

function throwBillingError(error: BillingError): never {
  const code =
    error.code === 'INVALID_CAP' || error.code === 'PAY_AS_YOU_GO_DISABLED'
      ? 'invalid-argument'
      : error.code === 'PAYMENT_METHOD_REQUIRED' || error.code === 'BILLING_NOT_READY'
        ? 'failed-precondition'
        : 'internal';

  throw new HttpsError(code, error.message, { code: error.code });
}

function resolveAppOrigin(requestData: unknown): string {
  if (typeof requestData === 'object' && requestData !== null) {
    const origin = (requestData as { origin?: unknown }).origin;
    if (typeof origin === 'string' && origin.startsWith('http')) {
      return origin.replace(/\/$/, '');
    }
  }
  return 'http://localhost:4200';
}

export const createBillingCheckoutSessionEndpoint = onCall(
  {
    region: 'asia-east1',
    cors: true,
    secrets: [stripeSecretKey],
  },
  async (request): Promise<ApiResponse<ICreateBillingCheckoutSessionResponse>> => {
    try {
      const userId = await validateAuth(request);
      const origin = resolveAppOrigin(request.data);
      const checkoutUrl = await createBillingCheckoutSession({
        userId,
        email: request.auth?.token.email,
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
      const userId = await validateAuth(request);
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

export const updatePayAsYouGoSettingsEndpoint = onCall(
  { region: 'asia-east1', cors: true },
  async (request): Promise<ApiResponse<IUserBillingState>> => {
    try {
      const userId = await validateAuth(request);
      const payload = request.data as IUpdatePayAsYouGoSettingsRequest;
      const billing = await updatePayAsYouGoSettings(userId, {
        enabled: payload.enabled === true,
        monthlyCapCents: Number(payload.monthlyCapCents),
      });
      await getUserUsageSummary(userId);

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
      const userId = await validateAuth(request);
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
      const userId = await validateAuth(request);
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
      await handleStripeBillingWebhook({
        rawBody,
        signature,
        stripeSecretKey: stripeSecretKey.value(),
        stripeWebhookSecret: stripeWebhookSecret.value(),
      });
      res.status(200).json({ received: true });
    } catch (error) {
      res.status(400).send(error instanceof Error ? error.message : 'Webhook error');
    }
  },
);
