import 'server-only';

import type { DecodedIdToken } from 'firebase-admin/auth';

export function getSessionCookieName(): string {
  return process.env.ADMIN_SESSION_COOKIE_NAME || 'admin_session';
}

export function getAllowedBootstrapEmails(): Set<string> {
  const raw = process.env.ADMIN_ALLOWED_EMAILS;
  if (!raw) {
    return new Set();
  }
  return new Set(
    raw
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function hasAdminClaim(decoded: DecodedIdToken): boolean {
  if (decoded.admin === true) {
    return true;
  }

  const email = decoded.email?.toLowerCase();
  if (!email) {
    return false;
  }

  return getAllowedBootstrapEmails().has(email);
}

export function assertAdminClaim(decoded: DecodedIdToken): void {
  if (!hasAdminClaim(decoded)) {
    throw new Error('FORBIDDEN');
  }
}
