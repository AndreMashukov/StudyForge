import { onRequest } from 'firebase-functions/v2/https';
import { agentMessageSchema } from '@shared-types';
import { validateExternalAuthFromRequest } from '@study-forge/backend-core/lib/api-key-auth';
import { verifyAppCheckHeader } from '@study-forge/backend-core/lib/app-check-verification';
import { DirectoryAgentService } from '@study-forge/backend-agent';

const runningInFunctionsEmulator = process.env.FUNCTIONS_EMULATOR === 'true';

function writeSseEvent(
  res: import('express').Response,
  event: { type: string } & Record<string, unknown>
): void {
  res.write(`event: ${event.type}\n`);
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

export const agentMessageStream = onRequest(
  {
    cors: true,
    timeoutSeconds: 300,
    memory: '1GiB',
    region: 'asia-east1',
  },
  async (req, res) => {
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Firebase-AppCheck');
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.status(204).send('');
      return;
    }

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
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders?.();

    try {
      for await (const event of DirectoryAgentService.streamMessage(userId, parsed.data)) {
        writeSseEvent(res, event);
        if (event.type === 'error' || event.type === 'done') {
          break;
        }
      }
    } catch (error) {
      writeSseEvent(res, {
        type: 'error',
        message: error instanceof Error ? error.message : 'Agent stream failed',
      });
    } finally {
      res.end();
    }
  }
);
