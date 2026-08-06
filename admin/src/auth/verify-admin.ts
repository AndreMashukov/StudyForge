import 'server-only';

import type { DecodedIdToken } from 'firebase-admin/auth';

export function getSessionCookieName(): string {
  return process.env.ADMIN_SESSION_COOKIE_NAME || 'admin_session';
}

export function hasAdminClaim(decoded: DecodedIdToken): boolean {
  return decoded.role === 'admin';
}

export function assertAdminClaim(decoded: DecodedIdToken): void {
  if (!hasAdminClaim(decoded)) {
    throw new Error('FORBIDDEN');
  }
}
