export const USER_FACING_REQUEST_FAILED_MESSAGE =
  "Couldn't load this right now. Try again in a moment.";

const APP_CHECK_OPS_MESSAGE_MARKERS = [
  'reCAPTCHA v3 secret',
  'Firebase Console',
  'reCAPTCHA Admin',
  'App Check verification failed',
];

export function isUnauthenticatedCallableError(
  code: string | undefined,
  message: string | undefined,
): boolean {
  return code === 'functions/unauthenticated' && message === 'Unauthenticated';
}

export function getUserFacingCallableFailureMessage(params: {
  code?: string;
  message?: string;
}): string | undefined {
  if (isUnauthenticatedCallableError(params.code, params.message)) {
    return USER_FACING_REQUEST_FAILED_MESSAGE;
  }

  if (
    typeof params.message === 'string' &&
    APP_CHECK_OPS_MESSAGE_MARKERS.some((marker) =>
      params.message?.includes(marker),
    )
  ) {
    return USER_FACING_REQUEST_FAILED_MESSAGE;
  }

  return undefined;
}
