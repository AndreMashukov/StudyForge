import { NextResponse } from 'next/server';
import { parseRuleBlueprintForm, parseUpdateRuleBlueprintForm } from '@shared-types';
import { revalidatePath } from 'next/cache';
import { getAdminApiStatusCode } from '@admin/app/api/_utils/route-utils';
import { requireAdminSession } from '@admin/auth/session';
import {
  createRuleBlueprint,
  listRuleBlueprints,
} from '@admin/data/rule-blueprints';

export async function GET() {
  try {
    const blueprints = await listRuleBlueprints();
    return NextResponse.json({ success: true, blueprints });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to load rule blueprints.';
    return NextResponse.json(
      { success: false, message },
      { status: getAdminApiStatusCode(error) },
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAdminSession();
    const body = parseRuleBlueprintForm(await request.json());
    const blueprint = await createRuleBlueprint(body, session.uid);
    revalidatePath('/rule-blueprints');
    return NextResponse.json({ success: true, blueprint });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to create rule blueprint.';
    return NextResponse.json(
      { success: false, message },
      { status: getAdminApiStatusCode(error) },
    );
  }
}
