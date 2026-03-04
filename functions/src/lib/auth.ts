import { CallableRequest, HttpsError } from 'firebase-functions/v2/https';

/**
 * Validates that the callable request is authenticated and returns the user's UID.
 * Throws an HttpsError with code 'unauthenticated' if not authenticated.
 */
export function validateAuth(request: CallableRequest): string {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'The function must be called while authenticated.');
  }
  return request.auth.uid;
}
