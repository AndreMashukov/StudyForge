import { NextResponse } from 'next/server';
import { getAdminApiStatusCode } from '../../../../../lib/api/route-utils';
import { requireAdminSession } from '../../../../../lib/auth/session';
import { testStoredGeminiConnection } from '../../../../../lib/data/model-settings';

export async function POST() {
  try {
    const session = await requireAdminSession();
    const result = await testStoredGeminiConnection(session.uid);

    return NextResponse.json({
      success: result.result.success,
      result: result.result,
      geminiConnection: result.geminiConnection,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to test Gemini settings.';
    return NextResponse.json({ success: false, message }, { status: getAdminApiStatusCode(error) });
  }
}
