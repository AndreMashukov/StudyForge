import { NextResponse, type NextRequest } from 'next/server';
import { getSessionCookieName } from './lib/auth/verify-admin';
import { verifyAdminSessionCookie } from './lib/auth/session';

const PUBLIC_ROUTES = new Set(['/login', '/unauthorized']);

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_ROUTES.has(pathname)) {
    return true;
  }
  if (pathname === '/api/health' || pathname.startsWith('/api/auth/session')) {
    return true;
  }
  return false;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get(getSessionCookieName())?.value;
  const session = sessionCookie
    ? await verifyAdminSessionCookie(sessionCookie)
    : null;

  if (pathname === '/login' && session) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  if (!session) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname === '/unauthorized') {
    return NextResponse.next();
  }

  return NextResponse.next();
}
