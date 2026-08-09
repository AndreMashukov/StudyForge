import { NextResponse } from 'next/server';
import type { IUpdateLlmGenerationSettingsRequest } from '@shared-types';
import { getAdminApiStatusCode } from '@admin/app/api/_utils/route-utils';
import { requireAdminSession } from '@admin/auth/session';
import {
  readLlmGenerationSettings,
  updateLlmGenerationSettings,
} from '@admin/data/llm-generation-settings';

export async function GET() {
  try {
    await requireAdminSession();
    const settings = await readLlmGenerationSettings();
    return NextResponse.json({ success: true, settings });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to load LLM generation settings.';
    return NextResponse.json(
      { success: false, message },
      { status: getAdminApiStatusCode(error) },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const session = await requireAdminSession();
    const body = (await request.json()) as IUpdateLlmGenerationSettingsRequest;
    const settings = await updateLlmGenerationSettings(body, session.uid);
    return NextResponse.json({ success: true, settings });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to save LLM generation settings.';
    return NextResponse.json(
      { success: false, message },
      { status: getAdminApiStatusCode(error) },
    );
  }
}
