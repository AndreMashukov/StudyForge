import { NextResponse } from 'next/server';
import { getAdminApiStatusCode } from '../../../lib/api/route-utils';
import { requireAdminSession } from '../../../lib/auth/session';
import { createLlmSetupFromRequest, listLlmSetups } from '../../../lib/data/llm-setups';

export async function GET() {
  try {
    const setups = await listLlmSetups();
    return NextResponse.json({ success: true, setups });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load LLM setups.';
    return NextResponse.json({ success: false, message }, { status: getAdminApiStatusCode(error) });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAdminSession();
    const body = (await request.json()) as Record<string, unknown>;
    const setup = await createLlmSetupFromRequest(body, session.uid);
    return NextResponse.json({ success: true, setup });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create LLM setup.';
    return NextResponse.json({ success: false, message }, { status: getAdminApiStatusCode(error) });
  }
}
