import 'server-only';

import { cookies } from 'next/headers';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { getAdminAuth } from '../firebase/admin';
import { assertAdminClaim, getSessionCookieName, hasAdminClaim } from './verify-admin';

export const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

export interface IAdminSession {
  uid: string;
  email?: string;
  claims: DecodedIdToken;
}

export async function createAdminSessionCookie(idToken: string): Promise<string> {
  const auth = getAdminAuth();
  const decoded = await auth.verifyIdToken(idToken);
  assertAdminClaim(decoded);

  return auth.createSessionCookie(idToken, {
    expiresIn: SESSION_MAX_AGE_SECONDS * 1000,
  });
}

export async function verifyAdminSessionCookie(
  sessionCookie: string
): Promise<IAdminSession | null> {
  try {
    const auth = getAdminAuth();
    const claims = await auth.verifySessionCookie(sessionCookie, true);

    if (!hasAdminClaim(claims)) {
      return null;
    }

    return {
      uid: claims.uid,
      email: claims.email,
      claims,
    };
  } catch {
    return null;
  }
}

export async function getAdminSessionFromCookies(): Promise<IAdminSession | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(getSessionCookieName())?.value;
  if (!sessionCookie) {
    return null;
  }
  return verifyAdminSessionCookie(sessionCookie);
}

export async function requireAdminSession(): Promise<IAdminSession> {
  const session = await getAdminSessionFromCookies();
  if (!session) {
    throw new Error('UNAUTHORIZED');
  }
  return session;
}

export async function setAdminSessionCookie(sessionCookie: string): Promise<void> {
  const cookieStore = await cookies();
  const isProduction = process.env.NODE_ENV === 'production';

  cookieStore.set(getSessionCookieName(), sessionCookie, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function clearAdminSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(getSessionCookieName());
}

export async function revokeAdminSession(session: IAdminSession): Promise<void> {
  await getAdminAuth().revokeRefreshTokens(session.uid);
  await clearAdminSessionCookie();
}
