import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getAdminApiStatusCode } from '@admin/app/api/_utils/route-utils';
import { requireAdminSession } from '@admin/auth/session';
import { publishRuleBlueprint } from '@admin/data/rule-blueprints';

interface IRouteContext {
  params: Promise<{ blueprintId: string }>;
}

export async function POST(_request: Request, context: IRouteContext) {
  try {
    const session = await requireAdminSession();
    const { blueprintId } = await context.params;
    const blueprint = await publishRuleBlueprint(blueprintId, session.uid);
    revalidatePath('/rule-blueprints');
    revalidatePath(`/rule-blueprints/${blueprintId}`);
    return NextResponse.json({ success: true, blueprint });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to publish rule blueprint.';
    return NextResponse.json(
      { success: false, message },
      { status: getAdminApiStatusCode(error) },
    );
  }
}
