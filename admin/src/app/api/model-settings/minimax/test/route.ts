import { NextResponse } from 'next/server';
import { requireAdminSession } from '../../../../../lib/auth/session';
import { testStoredMiniMaxConnection } from '../../../../../lib/data/model-settings';

function getStatusCode(error: unknown): number {
  const message = error instanceof Error ? error.message : '';

  if (message === 'UNAUTHORIZED') {
    return 401;
  }

  return 400;
}

export async function POST() {
  try {
    const session = await requireAdminSession();
    const result = await testStoredMiniMaxConnection(session.uid);

    return NextResponse.json({
      success: result.result.success,
      result: result.result,
      miniMaxConnection: result.miniMaxConnection,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to test MiniMax settings.';

    return NextResponse.json(
      { success: false, message },
      { status: getStatusCode(error) }
    );
  }
}
