import { NextResponse } from 'next/server';
import { requireAdminSession } from '../../../../../lib/auth/session';
import { testStoredTogetherConnection } from '../../../../../lib/data/model-settings';

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
    const result = await testStoredTogetherConnection(session.uid);

    return NextResponse.json({
      success: result.result.success,
      result: result.result,
      togetherConnection: result.togetherConnection,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to test Together settings.';

    return NextResponse.json(
      { success: false, message },
      { status: getStatusCode(error) }
    );
  }
}
