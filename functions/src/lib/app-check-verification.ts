import { getAppCheck } from 'firebase-admin/app-check';
import type { Request, Response } from 'express';

interface AppCheckVerificationFailure {
  ok: false;
}

interface AppCheckVerificationSuccess {
  ok: true;
}

export type AppCheckVerificationResult =
  | AppCheckVerificationFailure
  | AppCheckVerificationSuccess;

/**
 * Verifies the X-Firebase-AppCheck header for onRequest HTTP handlers.
 *
 * Callable functions rely on enforceAppCheck instead. Routes that use third-party
 * credentials (API keys, IAM) should not call this helper.
 */
export async function verifyAppCheckHeader(
  req: Request,
  res: Response,
): Promise<AppCheckVerificationResult> {
  const appCheckToken = req.header('X-Firebase-AppCheck');

  if (!appCheckToken) {
    res.status(401).json({ success: false, error: 'Missing App Check token' });
    return { ok: false };
  }

  try {
    await getAppCheck().verifyToken(appCheckToken);
    return { ok: true };
  } catch {
    res.status(401).json({ success: false, error: 'Invalid App Check token' });
    return { ok: false };
  }
}
