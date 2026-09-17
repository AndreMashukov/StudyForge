import { NextResponse } from 'next/server';
import { getAdminApiStatusCode } from '@admin/app/api/_utils/route-utils';
import { requireAdminSession } from '@admin/auth/session';
import { readFeatureFlags, updateFeatureFlags } from '@admin/data/feature-flags';

export async function GET() {
  try {
    await requireAdminSession();
    const flags = await readFeatureFlags();
    return NextResponse.json({ success: true, flags });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to load feature flags.';
    return NextResponse.json(
      { success: false, message },
      { status: getAdminApiStatusCode(error) },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const session = await requireAdminSession();
    const body: unknown = await request.json();
    const flags = await updateFeatureFlags(body, session.uid);
    return NextResponse.json({ success: true, flags });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to save feature flags.';
    return NextResponse.json(
      { success: false, message },
      { status: getAdminApiStatusCode(error) },
    );
  }
}
