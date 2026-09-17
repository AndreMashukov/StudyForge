/** Public URL of the sibling sf-support app. Empty in production until it is deployed. */
export function getSupportAppUrl(): string | undefined {
  const raw = import.meta.env.NX_PUBLIC_SUPPORT_APP_URL;
  if (typeof raw !== 'string') {
    return undefined;
  }
  const trimmed = raw.trim().replace(/\/+$/, '');
  return trimmed.length > 0 ? trimmed : undefined;
}
