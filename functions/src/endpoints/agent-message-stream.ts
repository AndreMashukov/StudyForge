import { HttpsError, onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { agentMessageSchema } from '@shared-types';
import { validateExternalAuthFromRequest } from '@study-forge/backend-core/lib/api-key-auth';
import { verifyAppCheckHeader } from '@study-forge/backend-core/lib/app-check-verification';
import { DirectoryAgentService } from '@study-forge/backend-agent';
import {
  buildProviderCostContext,
  runWithProviderCostContext,
} from '@study-forge/backend-core/services/provider-cost';
import {
  enforceCallableAgentLoopLimits,
  settleAgentLoopUsageReservationSafe,
} from '@study-forge/backend-generation/generation-limits';

const runningInFunctionsEmulator = process.env.FUNCTIONS_EMULATOR === 'true';
const llmSettingsEncryptionKey = defineSecret('LLM_SETTINGS_ENCRYPTION_KEY');

const ALLOWED_AGENT_ORIGINS = [
  'http://localhost:4200',
  'http://127.0.0.1:4200',
  'http://localhost:4201',
  'http://127.0.0.1:4201',
  'https://study-forge-202604.web.app',
  'https://study-forge-202604.firebaseapp.com',
];

function writeSseEvent(
  res: import('express').Response,
  event: { type: string } & Record<string, unknown>,
): void {
  res.write(`event: ${event.type}\n`);
  res.write(`data: ${JSON.stringify(event)}\n\n`);
  // Cloud Run / proxies can buffer SSE without an explicit flush.
  const flushable = res as import('express').Response & { flush?: () => void };
  if (typeof flushable.flush === 'function') {
    flushable.flush();
  }
}

export const agentMessageStream = onRequest(
  {
    cors: ALLOWED_AGENT_ORIGINS,
    timeoutSeconds: 300,
    memory: '1GiB',
    region: 'asia-east1',
    secrets: [llmSettingsEncryptionKey],
  },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).json({ success: false, error: 'Method not allowed' });
      return;
    }

    if (!runningInFunctionsEmulator) {
      const appCheck = await verifyAppCheckHeader(req, res);
      if (!appCheck.ok) {
        return;
      }
    }

    let userId: string;
    try {
      const auth = await validateExternalAuthFromRequest(req);
      if (auth.authMethod !== 'firebase-id-token') {
        res
          .status(401)
          .json({ success: false, error: 'Firebase ID token required' });
        return;
      }
      userId = auth.userId;
    } catch (error) {
      res.status(401).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unauthorized',
      });
      return;
    }

    const parsed = agentMessageSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: parsed.error.issues.map((issue) => issue.message).join('; '),
      });
      return;
    }

    let usageReservationId: string;
    let loopBudgetCredits = 0;
    let pricePerCreditCents = 0;
    try {
      const usageKind =
        parsed.data.scope === 'workspace' ? 'directoryAgent' : 'directoryChat';
      const loopHold = await enforceCallableAgentLoopLimits(userId, usageKind);
      usageReservationId = loopHold.usageReservation.id;
      loopBudgetCredits = loopHold.usageReservation.credits;
      pricePerCreditCents = loopHold.pricePerCreditCents;
    } catch (error) {
      if (error instanceof HttpsError) {
        const status =
          error.code === 'resource-exhausted'
            ? 429
            : error.code === 'unauthenticated'
              ? 401
              : error.code === 'permission-denied'
                ? 403
                : error.code === 'invalid-argument'
                  ? 400
                  : 500;
        res.status(status).json({
          success: false,
          error: error.message,
          details: error.details,
        });
        return;
      }
      res.status(500).json({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to reserve usage credits',
      });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    let clientDisconnected = false;
    req.on('close', () => {
      clientDisconnected = true;
    });

    let usageSettled = false;
    const settleLoopUsage = async (): Promise<void> => {
      if (usageSettled) {
        return;
      }
      usageSettled = true;
      await settleAgentLoopUsageReservationSafe(userId, usageReservationId);
    };
    const providerCostContext = buildProviderCostContext({
      userId,
      generationKind:
        parsed.data.scope === 'workspace' ? 'directoryAgent' : 'directoryChat',
      reservationId: usageReservationId,
      threadId: parsed.data.threadId,
      callRole: 'agent_step',
      loopBudgetCredits,
      pricePerCreditCents,
    });

    try {
      await runWithProviderCostContext(providerCostContext, async () => {
        for await (const event of DirectoryAgentService.streamMessage(
          userId,
          parsed.data,
        )) {
          if (clientDisconnected || res.writableEnded) {
            break;
          }
          writeSseEvent(res, event);
          if (event.type === 'done' || event.type === 'error') {
            await settleLoopUsage();
            break;
          }
        }
      });
    } catch (error) {
      if (!clientDisconnected && !res.writableEnded) {
        writeSseEvent(res, {
          type: 'error',
          message:
            error instanceof Error ? error.message : 'Agent stream failed',
        });
      }
    } finally {
      await settleLoopUsage();
      if (!res.writableEnded) {
        res.end();
      }
    }
  },
);
