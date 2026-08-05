import { NextResponse } from 'next/server';
import { getAdminApiStatusCode } from '../../../lib/api/route-utils';
import { requireAdminSession } from '../../../lib/auth/session';
import {
  createUsageLimitsSetupFromRequest,
  listUsageLimitsSetups,
  seedDefaultUsageLimitsSetups,
} from '../../../lib/data/usage-limits-setups';

export async function GET() {
  try {
    const setups = await listUsageLimitsSetups();
    return NextResponse.json({ success: true, setups });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to load usage limits setups.';
    return NextResponse.json({ success: false, message }, { status: getAdminApiStatusCode(error) });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAdminSession();
    const body = (await request.json()) as Record<string, unknown>;

    if (body.seedDefaults === true) {
      const setups = await seedDefaultUsageLimitsSetups(session.uid);
      return NextResponse.json({ success: true, setups });
    }

    const setup = await createUsageLimitsSetupFromRequest(body, session.uid);
    return NextResponse.json({ success: true, setup });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to create usage limits setup.';
    return NextResponse.json({ success: false, message }, { status: getAdminApiStatusCode(error) });
  }
}
