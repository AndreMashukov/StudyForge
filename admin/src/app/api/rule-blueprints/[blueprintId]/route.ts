import { NextResponse } from 'next/server';
import { updateRuleBlueprintFormSchema } from '@shared-types';
import { revalidatePath } from 'next/cache';
import { getAdminApiStatusCode } from '@admin/app/api/_utils/route-utils';
import { requireAdminSession } from '@admin/auth/session';
import {
  deleteRuleBlueprint,
  getRuleBlueprint,
  updateRuleBlueprint,
} from '@admin/data/rule-blueprints';

interface IRouteContext {
  params: Promise<{ blueprintId: string }>;
}

export async function GET(_request: Request, context: IRouteContext) {
  try {
    const { blueprintId } = await context.params;
    const blueprint = await getRuleBlueprint(blueprintId);
    if (!blueprint) {
      return NextResponse.json(
        { success: false, message: 'Rule blueprint not found.' },
        { status: 404 },
      );
    }
    return NextResponse.json({ success: true, blueprint });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to load rule blueprint.';
    return NextResponse.json(
      { success: false, message },
      { status: getAdminApiStatusCode(error) },
    );
  }
}

export async function PUT(request: Request, context: IRouteContext) {
  try {
    const session = await requireAdminSession();
    const { blueprintId } = await context.params;
    const body = updateRuleBlueprintFormSchema.parse(await request.json());
    const blueprint = await updateRuleBlueprint(
      blueprintId,
      body,
      session.uid,
    );
    revalidatePath('/rule-blueprints');
    revalidatePath(`/rule-blueprints/${blueprintId}`);
    return NextResponse.json({ success: true, blueprint });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to update rule blueprint.';
    return NextResponse.json(
      { success: false, message },
      { status: getAdminApiStatusCode(error) },
    );
  }
}

export async function DELETE(_request: Request, context: IRouteContext) {
  try {
    const { blueprintId } = await context.params;
    await deleteRuleBlueprint(blueprintId);
    revalidatePath('/rule-blueprints');
    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to delete rule blueprint.';
    return NextResponse.json(
      { success: false, message },
      { status: getAdminApiStatusCode(error) },
    );
  }
}
