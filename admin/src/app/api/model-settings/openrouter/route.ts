import { NextResponse } from 'next/server';
import type { IUpdateOpenRouterSettingsRequest } from '@shared-types';
import { requireAdminSession } from '../../../../lib/auth/session';
import {
  getModelSettingsPageData,
  updateOpenRouterSettings,
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
      openRouterConnection: data.openRouterConnection,
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
    const body = (await request.json()) as Partial<IUpdateOpenRouterSettingsRequest>;

    const openRouterConnection = await updateOpenRouterSettings(
      {
        baseUrl: body.baseUrl ?? '',
        defaultModel: body.defaultModel ?? '',
        defaultVisionModel: body.defaultVisionModel,
        defaultImageModel: body.defaultImageModel,
        apiKey: body.apiKey,
        headers: body.headers,
      },
      session.uid
    );

    return NextResponse.json({
      success: true,
      openRouterConnection,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to save OpenRouter settings.';

    return NextResponse.json(
      { success: false, message },
      { status: getStatusCode(error) }
    );
  }
}