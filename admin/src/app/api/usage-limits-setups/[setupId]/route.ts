import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getAdminApiStatusCode } from '../../../../lib/api/route-utils';
import { requireAdminSession } from '../../../../lib/auth/session';
import {
  deleteUsageLimitsSetup,
  getUsageLimitsSetupById,
  updateUsageLimitsSetupFromRequest,
} from '../../../../lib/data/usage-limits-setups';

interface IRouteContext {
  params: Promise<{ setupId: string }>;
}

export async function GET(_request: Request, context: IRouteContext) {
  try {
    const { setupId } = await context.params;
    const setup = await getUsageLimitsSetupById(setupId);

    if (!setup) {
      return NextResponse.json(
        { success: false, message: 'Usage limits setup not found.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, setup });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to load usage limits setup.';
    return NextResponse.json({ success: false, message }, { status: getAdminApiStatusCode(error) });
  }
}

export async function PUT(request: Request, context: IRouteContext) {
  try {
    const session = await requireAdminSession();
    const { setupId } = await context.params;
    const body = (await request.json()) as Record<string, unknown>;
    const setup = await updateUsageLimitsSetupFromRequest(setupId, body, session.uid);
    revalidatePath('/usage-limits-setups');
    revalidatePath(`/usage-limits-setups/${setupId}`);
    return NextResponse.json({ success: true, setup });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to update usage limits setup.';
    return NextResponse.json({ success: false, message }, { status: getAdminApiStatusCode(error) });
  }
}

export async function DELETE(_request: Request, context: IRouteContext) {
  try {
    await requireAdminSession();
    const { setupId } = await context.params;
    await deleteUsageLimitsSetup(setupId);
    revalidatePath('/usage-limits-setups');
    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to delete usage limits setup.';
    return NextResponse.json({ success: false, message }, { status: getAdminApiStatusCode(error) });
  }
}
