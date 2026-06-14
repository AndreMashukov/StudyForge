import { NextResponse } from 'next/server';
import type { ISetActiveModelProviderRequest } from '@shared-types';
import { requireAdminSession } from '../../../../lib/auth/session';
import {
  isActiveModelProviderType,
  setActiveModelProvider,
} from '../../../../lib/data/model-settings';

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
    const body = (await request.json()) as Partial<ISetActiveModelProviderRequest>;

    if (!isActiveModelProviderType(body.providerType)) {
      throw new Error('A valid providerType is required.');
    }

    const data = await setActiveModelProvider(body.providerType, session.uid);

    return NextResponse.json({
      success: true,
      activeProviderId: data.activeProviderId,
      geminiConnection: data.geminiConnection,
      openRouterConnection: data.openRouterConnection,
      miniMaxConnection: data.miniMaxConnection,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to update active provider.';

    return NextResponse.json(
      { success: false, message },
      { status: getStatusCode(error) }
    );
  }
}
