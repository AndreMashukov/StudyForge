import { NextResponse } from 'next/server';
import type { IUpdateLlmSetupRequest } from '@shared-types';
import { revalidatePath } from 'next/cache';
import { getAdminApiStatusCode } from '../../../../lib/api/route-utils';
import { requireAdminSession } from '../../../../lib/auth/session';
import {
  deleteLlmSetup,
  getLlmSetupById,
  updateLlmSetup,
} from '../../../../lib/data/llm-setups';

interface IRouteContext {
  params: Promise<{ setupId: string }>;
}

export async function GET(_request: Request, context: IRouteContext) {
  try {
    const { setupId } = await context.params;
    const setup = await getLlmSetupById(setupId);

    if (!setup) {
      return NextResponse.json({ success: false, message: 'LLM setup not found.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, setup });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load LLM setup.';
    return NextResponse.json({ success: false, message }, { status: getAdminApiStatusCode(error) });
  }
}

export async function PUT(request: Request, context: IRouteContext) {
  try {
    const session = await requireAdminSession();
    const { setupId } = await context.params;
    const body = (await request.json()) as IUpdateLlmSetupRequest;
    const setup = await updateLlmSetup(setupId, body, session.uid);
    revalidatePath('/llm-setups');
    revalidatePath(`/llm-setups/${setupId}`);
    return NextResponse.json({ success: true, setup });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update LLM setup.';
    return NextResponse.json({ success: false, message }, { status: getAdminApiStatusCode(error) });
  }
}

export async function DELETE(_request: Request, context: IRouteContext) {
  try {
    await requireAdminSession();
    const { setupId } = await context.params;
    await deleteLlmSetup(setupId);
    revalidatePath('/llm-setups');
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete LLM setup.';
    return NextResponse.json({ success: false, message }, { status: getAdminApiStatusCode(error) });
  }
}
