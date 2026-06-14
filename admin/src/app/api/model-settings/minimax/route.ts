import { NextResponse } from 'next/server';
import type { IUpdateMiniMaxSettingsRequest } from '@shared-types';
import { requireAdminSession } from '../../../../lib/auth/session';
import {
  getModelSettingsPageData,
  updateMiniMaxSettings,
} from '../../../../lib/data/model-settings';

function getStatusCode(error: unknown): number {
  const message = error instanceof Error ? error.message : '';

  if (message === 'UNAUTHORIZED') {
    return 401;
  }

  return 400;
}

export async function GET() {
  try {
    const data = await getModelSettingsPageData();

    return NextResponse.json({
      success: true,
      miniMaxConnection: data.miniMaxConnection,
      encryptionConfigured: data.encryptionConfigured,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to load model settings.';

    return NextResponse.json(
      { success: false, message },
      { status: getStatusCode(error) }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const session = await requireAdminSession();
    const body = (await request.json()) as Partial<IUpdateMiniMaxSettingsRequest>;

    const miniMaxConnection = await updateMiniMaxSettings(
      {
        baseUrl: body.baseUrl ?? '',
        defaultModel: body.defaultModel ?? '',
        defaultVisionModel: body.defaultVisionModel,
        defaultImageModel: body.defaultImageModel,
        imageGenerationUrl: body.imageGenerationUrl ?? '',
        apiKey: body.apiKey,
      },
      session.uid
    );

    return NextResponse.json({
      success: true,
      miniMaxConnection,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to save MiniMax settings.';

    return NextResponse.json(
      { success: false, message },
      { status: getStatusCode(error) }
    );
  }
}
