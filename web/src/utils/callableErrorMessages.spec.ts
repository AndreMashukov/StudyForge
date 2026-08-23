import { describe, expect, it } from 'vitest';
import {
  getUserFacingCallableFailureMessage,
  USER_FACING_REQUEST_FAILED_MESSAGE,
} from './callableErrorMessages';

describe('getUserFacingCallableFailureMessage', () => {
  it('hides App Check ops copy from end users', () => {
    expect(
      getUserFacingCallableFailureMessage({
        code: 'functions/unauthenticated',
        message: 'Unauthenticated',
      }),
    ).toBe(USER_FACING_REQUEST_FAILED_MESSAGE);

    expect(
      getUserFacingCallableFailureMessage({
        message:
          'App Check verification failed. Ensure the reCAPTCHA v3 secret is registered in Firebase Console.',
      }),
    ).toBe(USER_FACING_REQUEST_FAILED_MESSAGE);
  });

  it('does not rewrite unrelated callable errors', () => {
    expect(
      getUserFacingCallableFailureMessage({
        code: 'functions/internal',
        message: 'Failed to get interaction stats',
      }),
    ).toBeUndefined();
  });
});
