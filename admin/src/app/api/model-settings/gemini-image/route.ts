import { NextResponse } from 'next/server';
import type { IUpdateGeminiImageSettingsRequest } from '@shared-types';
import { requireAdminSession } from '../../../../lib/auth/session';
import { updateGeminiImageSettings } from '../../../../lib/data/model-settings';

function getStatusCode(error: unknown): number {
  const message = error instanceof Error ? error.message : '';
  if (message === 'UNAUTHORIZED') {
    return 401;
  }
  return 400;
}

export async function PUT(request: Request) {
  try {
    const session = await requireAdminSession();
    const body = (await request.json()) as Partial<IUpdateGeminiImageSettingsRequest>;

    const geminiImageConnection = await updateGeminiImageSettings(
      {
        enabled: body.enabled ?? true,
        defaultModel: body.defaultModel ?? '',
      },
      session.uid
    );

    return NextResponse.json({
      success: true,
      geminiImageConnection,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to save image model settings.';

    return NextResponse.json(
      { success: false, message },
      { status: getStatusCode(error) }
    );
  }
}
