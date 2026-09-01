import { NextResponse } from 'next/server';
import type { ICreatePlatformAgentKnowledgeDocumentRequest } from '@shared-types';
import { revalidatePath } from 'next/cache';
import { getAdminApiStatusCode } from '@admin/app/api/_utils/route-utils';
import { requireAdminSession } from '@admin/auth/session';
import {
  createPlatformAgentKnowledgeDocument,
  listPlatformAgentKnowledgeDocuments,
} from '@admin/data/platform-agent-knowledge';

export async function GET() {
  try {
    const documents = await listPlatformAgentKnowledgeDocuments();
    return NextResponse.json({ success: true, documents });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to load agent knowledge documents.';
    return NextResponse.json({ success: false, message }, { status: getAdminApiStatusCode(error) });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAdminSession();
    const body = (await request.json()) as ICreatePlatformAgentKnowledgeDocumentRequest;
    const document = await createPlatformAgentKnowledgeDocument(body, session.uid);
    revalidatePath('/agent-knowledge');
    return NextResponse.json({ success: true, document });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to create agent knowledge document.';
    return NextResponse.json({ success: false, message }, { status: getAdminApiStatusCode(error) });
  }
}
