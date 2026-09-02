import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getAdminApiStatusCode } from '@admin/app/api/_utils/route-utils';
import { archiveRuleBlueprint } from '@admin/data/rule-blueprints';

interface IRouteContext {
  params: Promise<{ blueprintId: string }>;
}

export async function POST(_request: Request, context: IRouteContext) {
  try {
    const { blueprintId } = await context.params;
    await archiveRuleBlueprint(blueprintId);
    revalidatePath('/rule-blueprints');
    revalidatePath(`/rule-blueprints/${blueprintId}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to archive rule blueprint.';
    return NextResponse.json(
      { success: false, message },
      { status: getAdminApiStatusCode(error) },
    );
  }
}
