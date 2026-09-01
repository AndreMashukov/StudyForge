import { NextResponse } from 'next/server';
import type { IUpdatePlatformAgentKnowledgeDocumentRequest } from '@shared-types';
import { revalidatePath } from 'next/cache';
import { getAdminApiStatusCode } from '@admin/app/api/_utils/route-utils';
import { requireAdminSession } from '@admin/auth/session';
import {
  deletePlatformAgentKnowledgeDocument,
  getPlatformAgentKnowledgeDocument,
  updatePlatformAgentKnowledgeDocument,
} from '@admin/data/platform-agent-knowledge';

interface IRouteContext {
  params: Promise<{ docId: string }>;
}

export async function GET(_request: Request, context: IRouteContext) {
  try {
    const { docId } = await context.params;
    const document = await getPlatformAgentKnowledgeDocument(docId);
    if (!document) {
      return NextResponse.json(
        { success: false, message: 'Knowledge document not found.' },
        { status: 404 },
      );
    }
    return NextResponse.json({ success: true, document });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to load agent knowledge document.';
    return NextResponse.json({ success: false, message }, { status: getAdminApiStatusCode(error) });
  }
}

export async function PUT(request: Request, context: IRouteContext) {
  try {
    const session = await requireAdminSession();
    const { docId } = await context.params;
    const body = (await request.json()) as IUpdatePlatformAgentKnowledgeDocumentRequest;
    const document = await updatePlatformAgentKnowledgeDocument(
      docId,
      body,
      session.uid,
    );
    revalidatePath('/agent-knowledge');
    revalidatePath(`/agent-knowledge/${docId}`);
    return NextResponse.json({ success: true, document });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to update agent knowledge document.';
    return NextResponse.json({ success: false, message }, { status: getAdminApiStatusCode(error) });
  }
}

export async function DELETE(_request: Request, context: IRouteContext) {
  try {
    await requireAdminSession();
    const { docId } = await context.params;
    await deletePlatformAgentKnowledgeDocument(docId);
    revalidatePath('/agent-knowledge');
    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to delete agent knowledge document.';
    return NextResponse.json({ success: false, message }, { status: getAdminApiStatusCode(error) });
  }
}
