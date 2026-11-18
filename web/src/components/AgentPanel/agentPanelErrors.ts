export function isAgentThreadMissingError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  if (!('status' in error) || !('data' in error)) {
    return false;
  }
  if (typeof error.data !== 'object' || error.data === null) {
    return false;
  }

  const message =
    'message' in error.data && typeof error.data.message === 'string'
      ? error.data.message
      : '';
  const code =
    'code' in error.data && typeof error.data.code === 'string'
      ? error.data.code
      : '';

  if (error.status === 'CUSTOM_ERROR') {
    return code === 'NOT_FOUND' || message === 'Thread not found';
  }

  return (
    error.status === 'functions/not-found' &&
    message === 'Agent thread not found'
  );
}

/** User-facing message from an RTK Query callable error (`unwrap()` rejection). */
export function readAgentRequestErrorMessage(
  error: unknown,
  fallback: string,
): string {
  if (typeof error === 'object' && error !== null && 'data' in error) {
    const data = error.data;
    if (
      typeof data === 'object' &&
      data !== null &&
      'message' in data &&
      typeof data.message === 'string' &&
      data.message.trim().length > 0
    ) {
      return data.message;
    }
  }
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return fallback;
}
