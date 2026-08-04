import { onRequest } from 'firebase-functions/v2/https';
import { agentMessageSchema } from '@shared-types';
import { validateExternalAuthFromRequest } from '@study-forge/backend-core/lib/api-key-auth';
import { verifyAppCheckHeader } from '@study-forge/backend-core/lib/app-check-verification';
import { DirectoryAgentService } from '@study-forge/backend-agent';

const runningInFunctionsEmulator = process.env.FUNCTIONS_EMULATOR === 'true';

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
  event: { type: string } & Record<string, unknown>
): void {
  res.write(`event: ${event.type}\n`);
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

export const agentMessageStream = onRequest(
  {
    cors: ALLOWED_AGENT_ORIGINS,
    timeoutSeconds: 300,
    memory: '1GiB',
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
        res.status(401).json({ success: false, error: 'Firebase ID token required' });
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

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    let clientDisconnected = false;
    req.on('close', () => {
      clientDisconnected = true;
    });

    try {
      for await (const event of DirectoryAgentService.streamMessage(userId, parsed.data)) {
        if (clientDisconnected || res.writableEnded) {
          break;
        }
        writeSseEvent(res, event);
        if (event.type === 'error' || event.type === 'done') {
          break;
        }
      }
    } catch (error) {
      if (!clientDisconnected && !res.writableEnded) {
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
  }
);
