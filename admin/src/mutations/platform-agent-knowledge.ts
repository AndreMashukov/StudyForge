'use client';

import { z } from 'zod';
import type {
  ICreatePlatformAgentKnowledgeDocumentRequest,
  IUpdatePlatformAgentKnowledgeDocumentRequest,
} from '@shared-types';
import { requestJsonValidated } from './client';

const knowledgeDocumentMutationSchema = z.object({
  success: z.boolean().optional(),
  message: z.string().optional(),
  document: z
    .object({
      id: z.string(),
    })
    .optional(),
});

export async function savePlatformAgentKnowledgeDocument(
  docId: string | undefined,
  payload:
    | ICreatePlatformAgentKnowledgeDocumentRequest
    | IUpdatePlatformAgentKnowledgeDocumentRequest,
) {
  return requestJsonValidated(
    docId ? `/api/agent-knowledge/${docId}` : '/api/agent-knowledge',
    knowledgeDocumentMutationSchema,
    {
      method: docId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  );
}

export async function publishPlatformAgentKnowledgeDocument(docId: string) {
  return requestJsonValidated(
    `/api/agent-knowledge/${docId}/publish`,
    knowledgeDocumentMutationSchema,
    { method: 'POST' },
  );
}

export async function deletePlatformAgentKnowledgeDocument(docId: string) {
  return requestJsonValidated(
    `/api/agent-knowledge/${docId}`,
    knowledgeDocumentMutationSchema,
    { method: 'DELETE' },
  );
}
