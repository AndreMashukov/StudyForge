'use client';

import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';

export function buildAdminLoginUrl(fromPathname: string): string {
  return `/login?from=${encodeURIComponent(fromPathname)}`;
}

export function isAdminUnauthorizedResponse(response: Response): boolean {
  return response.status === 401;
}

export function redirectToAdminLogin(
  router: AppRouterInstance,
  fromPathname: string
): void {
  router.push(buildAdminLoginUrl(fromPathname));
}
