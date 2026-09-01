import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getAdminApiStatusCode } from '@admin/app/api/_utils/route-utils';
import { requireAdminSession } from '@admin/auth/session';
import { publishPlatformAgentKnowledgeDocument } from '@admin/data/platform-agent-knowledge';

interface IRouteContext {
  params: Promise<{ docId: string }>;
}

export async function POST(_request: Request, context: IRouteContext) {
  try {
    const session = await requireAdminSession();
    const { docId } = await context.params;
    const document = await publishPlatformAgentKnowledgeDocument(docId, session.uid);
    revalidatePath('/agent-knowledge');
    revalidatePath(`/agent-knowledge/${docId}`);
    return NextResponse.json({ success: true, document });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to publish agent knowledge document.';
    return NextResponse.json({ success: false, message }, { status: getAdminApiStatusCode(error) });
  }
}
