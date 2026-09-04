import { getAuth } from 'firebase-admin/auth';
import { HttpsError } from 'firebase-functions/v2/https';
import { userHasEmailVerificationExemption } from '../services/user-onboarding-service';

export interface ICallableAuthContext {
  auth?: {
    uid?: string;
    token?: {
      email_verified?: boolean;
      email?: string;
      name?: string;
    };
  };
}

/**
 * Validates that the callable request is authenticated and returns the user's UID.
 * Throws an HttpsError with code 'unauthenticated' if not authenticated.
 */
export function validateAuth(request: ICallableAuthContext): string {
  if (!request.auth?.uid) {
    throw new HttpsError(
      'unauthenticated',
      'The function must be called while authenticated.',
    );
  }
  return request.auth.uid;
}

/**
 * Validates auth and requires a verified email unless the user is admin-exempt.
 */
export async function validateVerifiedAuth(
  request: ICallableAuthContext,
): Promise<string> {
  const userId = validateAuth(request);

  if (request.auth?.token?.email_verified === true) {
    return userId;
  }

  const authUser = await getAuth().getUser(userId);
  if (authUser.emailVerified) {
    return userId;
  }

  if (await userHasEmailVerificationExemption(userId)) {
    return userId;
  }

  throw new HttpsError(
    'failed-precondition',
    'Verify your email before opening your StudyForge workspace.',
  );
}
