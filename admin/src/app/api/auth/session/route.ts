import { NextResponse } from 'next/server';
import { clearAdminSessionCookie, createAdminSessionCookie, getAdminSessionFromCookies, revokeAdminSession, setAdminSessionCookie } from '../../../../lib/auth/session';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { idToken?: string };
    if (!body.idToken) {
      return NextResponse.json(
        { success: false, message: 'Missing idToken' },
        { status: 400 }
      );
    }

    const sessionCookie = await createAdminSessionCookie(body.idToken);
    await setAdminSessionCookie(sessionCookie);

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Authentication failed';
    const status = message === 'FORBIDDEN' ? 403 : 401;
    return NextResponse.json({ success: false, message }, { status });
  }
}

export async function DELETE() {
  const session = await getAdminSessionFromCookies();
  if (session) {
    await revokeAdminSession(session);
  } else {
    await clearAdminSessionCookie();
  }

  return NextResponse.json({ success: true });
}
