import { randomUUID } from 'node:crypto';
import { HttpsError, onRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import {
  agentClientIdSchema,
  agentMessageSchema,
  startAgentTurnRequestSchema,
} from '@shared-types';
import { validateExternalAuthFromRequest } from '@study-forge/backend-core/lib/api-key-auth';
import { verifyAppCheckHeader } from '@study-forge/backend-core/lib/app-check-verification';
import { FirestorePaths } from '@study-forge/backend-core/lib/firestore-paths';
import { startAgentTurn, tailAgentTurnAsSse } from '@study-forge/backend-agent';

/**
 * Legacy SSE bridge (ADR 010). Agent turns now run in the runAgentTurnTask
 * worker; this endpoint starts the same durable turn and tails its turn doc
 * as the old SSE events, so app builds already installed keep working. A
 * client disconnect only ends the tail, never the turn. Remove once bridge
 * traffic (logged below) is negligible.
 */

const runningInFunctionsEmulator = process.env.FUNCTIONS_EMULATOR === 'true';

/** Stay under the 300s timeout; the turn keeps running after the tail ends. */
const MAX_TAIL_MS = 285_000;

const ALLOWED_AGENT_ORIGINS = [
  'http://localhost:4200',
  'http://127.0.0.1:4200',
  'http://localhost:4201',
  'http://127.0.0.1:4201',
  'https://study-forge-202604.web.app',
  'https://study-forge-202604.firebaseapp.com',
];

type SseResponse = import('express').Response & { flush?: () => void };

function writeSseEvent(
  res: SseResponse,
  event: { type: string } & Record<string, unknown>,
): void {
  res.write(`event: ${event.type}\n`);
  res.write(`data: ${JSON.stringify(event)}\n\n`);
  // Cloud Run / proxies can buffer SSE without an explicit flush.
  if (typeof res.flush === 'function') {
    res.flush();
  }
}

function httpStatusForCallableError(error: HttpsError): number {
  switch (error.code) {
    case 'resource-exhausted':
      return 429;
    case 'unauthenticated':
      return 401;
    case 'permission-denied':
      return 403;
    case 'invalid-argument':
      return 400;
    case 'not-found':
      return 404;
    case 'failed-precondition':
      return 409;
    case 'unavailable':
      return 503;
    default:
      return 500;
  }
}

function clientIdOrUndefined(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = agentClientIdSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

export const agentMessageStream = onRequest(
  {
    cors: ALLOWED_AGENT_ORIGINS,
    timeoutSeconds: 300,
    memory: '512MiB',
    region: 'asia-east1',
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
    const body = parsed.data;

    let threadId: string;
    let turnId: string;
    try {
      if (body.resume) {
        threadId = body.threadId ?? '';
        turnId = body.turnId ?? '';
        const turnSnap = await FirestorePaths.agentThreadTurn(
          userId,
          threadId,
          turnId,
        ).get();
        if (!turnSnap.exists) {
          throw new HttpsError('not-found', 'Agent turn not found');
        }
      } else {
        threadId =
          clientIdOrUndefined(body.threadId) ??
          FirestorePaths.agentThreads(userId).doc().id;
        turnId = clientIdOrUndefined(body.turnId) ?? randomUUID();
        const startInput = startAgentTurnRequestSchema.safeParse({
          scope: body.scope,
          directoryId: body.directoryId,
          message: body.message,
          threadId,
          turnId,
          promptContext: body.promptContext,
          clientLocalDate: body.clientLocalDate,
        });
        if (!startInput.success) {
          throw new HttpsError(
            'invalid-argument',
            startInput.error.issues.map((issue) => issue.message).join('; '),
          );
        }
        await startAgentTurn(userId, startInput.data);
      }
    } catch (error) {
      if (error instanceof HttpsError) {
        res.status(httpStatusForCallableError(error)).json({
          success: false,
          error: error.message,
          details: error.details,
        });
        return;
      }
      logger.error('Agent stream bridge failed to start the turn', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ success: false, error: 'Failed to start the agent' });
      return;
    }

    logger.info('Agent stream bridge request', {
      userId,
      threadId,
      turnId,
      resume: body.resume === true,
      userAgent: req.get('user-agent') ?? 'unknown',
    });

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.setHeader('Content-Encoding', 'identity');
    res.flushHeaders?.();

    const clientGone = new AbortController();
    // `res` close fires when the client disconnects (or the response ends).
    res.on('close', () => clientGone.abort());

    writeSseEvent(res, { type: 'thread', threadId });

    try {
      const end = await tailAgentTurnAsSse({
        userId,
        threadId,
        turnId,
        signal: clientGone.signal,
        maxDurationMs: MAX_TAIL_MS,
        write: (event) => {
          if (!res.writableEnded) {
            writeSseEvent(res, event);
          }
        },
      });
      if (end === 'missing' && !res.writableEnded) {
        writeSseEvent(res, { type: 'error', message: 'Agent turn not found' });
      }
    } catch (error) {
      if (!res.writableEnded) {
        writeSseEvent(res, {
          type: 'error',
          message: error instanceof Error ? error.message : 'Agent stream failed',
        });
      }
    } finally {
      if (!res.writableEnded) {
        res.end();
      }
    }
  },
);
