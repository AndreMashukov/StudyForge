import { NextResponse } from 'next/server';
import type { IUpdateGeminiSettingsRequest } from '@shared-types';
import { getAdminApiStatusCode } from '../../../../lib/api/route-utils';
import { requireAdminSession } from '../../../../lib/auth/session';
import { updateGeminiSettings } from '../../../../lib/data/model-settings';

export async function PUT(request: Request) {
  try {
    const session = await requireAdminSession();
    const body = (await request.json()) as IUpdateGeminiSettingsRequest;
    const geminiConnection = await updateGeminiSettings(body, session.uid);
    return NextResponse.json({ success: true, geminiConnection });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update Gemini settings.';
    return NextResponse.json({ success: false, message }, { status: getAdminApiStatusCode(error) });
  }
}
