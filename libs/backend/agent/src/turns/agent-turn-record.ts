import { Timestamp, type DocumentData } from 'firebase-admin/firestore';
import { z } from 'zod';
import type {
  AgentActionResult,
  AgentProposedDelete,
  AgentReferencedItem,
} from '@shared-types';
import {
  agentActionResultSchema,
  agentPromptContextSchema,
  agentProposedDeleteSchema,
  agentReferencedItemSchema,
  agentScopeSchema,
  agentTurnErrorSchema,
  agentTurnStatusSchema,
} from '@shared-types';

const timestampSchema = z.custom<Timestamp>(
  (value) => value instanceof Timestamp,
  'Expected a Firestore Timestamp',
);

/** Usage kinds an agent turn reserves credits under. */
export const agentTurnUsageKindSchema = z.enum([
  'directoryAgent',
  'directoryChat',
]);

export type AgentTurnUsageKind = z.output<typeof agentTurnUsageKindSchema>;

/** Drops malformed entries instead of failing the whole turn doc. */
function lenientArray<T extends z.ZodType>(schema: T) {
  return z
    .array(z.unknown())
    .default([])
    .transform((entries) =>
      entries.flatMap((entry) => {
        const parsed = schema.safeParse(entry);
        return parsed.success ? [parsed.data] : [];
      }),
    );
}

export const agentTurnRequestRecordSchema = z.object({
  message: z.string(),
  promptContext: agentPromptContextSchema.optional(),
  clientLocalDate: z.string().optional(),
  directoryId: z.string().trim().min(1).optional(),
});

export const agentTurnUsageRecordSchema = z.object({
  usageKind: agentTurnUsageKindSchema,
  reservationId: z.string().trim().min(1),
  loopBudgetCredits: z.number(),
  pricePerCreditCents: z.number(),
  periodKey: z.string().trim().min(1).optional(),
});

/** Server view of users/{uid}/agentThreads/{threadId}/turns/{turnId}. */
export const agentTurnRecordSchema = z.object({
  id: z.string().trim().min(1),
  threadId: z.string().trim().min(1),
  userId: z.string().trim().min(1),
  scope: agentScopeSchema,
  directoryId: z.string().trim().min(1).optional(),
  status: agentTurnStatusSchema,
  incomplete: z.boolean().default(false),
  statusMessage: z.string().nullable().optional(),
  reply: z.string().default(''),
  replySeq: z.number().int().nonnegative().default(0),
  executedActions: lenientArray(agentActionResultSchema),
  proposedDeletes: lenientArray(agentProposedDeleteSchema),
  referencedItems: lenientArray(agentReferencedItemSchema),
  userMessageId: z.string().trim().min(1),
  assistantMessageId: z.string().trim().min(1).nullable().optional(),
  error: agentTurnErrorSchema.nullable().optional(),
  cancelRequested: z.boolean().default(false),
  attempt: z.number().int().nonnegative().default(0),
  leaseId: z.string().trim().min(1).nullable().optional(),
  request: agentTurnRequestRecordSchema,
  usage: agentTurnUsageRecordSchema,
  evalRetrievedTexts: z.array(z.string()).optional(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
  startedAt: timestampSchema.optional(),
  heartbeatAt: timestampSchema.optional(),
  completedAt: timestampSchema.optional(),
});

export type AgentTurnRecord = z.output<typeof agentTurnRecordSchema>;

export function parseAgentTurnRecord(
  data: DocumentData | undefined,
): AgentTurnRecord | null {
  if (!data) {
    return null;
  }
  const parsed = agentTurnRecordSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

/** Milliseconds of the turn's latest sign of life (heartbeat, else last update). */
export function agentTurnLastActivityMs(turn: AgentTurnRecord): number {
  return (turn.heartbeatAt ?? turn.updatedAt).toMillis();
}

// Firestore rejects `undefined` values, so optional fields are only written when set.

export function serializeAgentActions(
  actions: AgentActionResult[],
): DocumentData[] {
  return actions.map((action) => ({
    kind: action.kind,
    summary: action.summary,
    ...(action.entityType ? { entityType: action.entityType } : {}),
    ...(action.entityId ? { entityId: action.entityId } : {}),
    ...(action.jobId ? { jobId: action.jobId } : {}),
  }));
}

export function serializeAgentDeletes(
  proposals: AgentProposedDelete[],
): DocumentData[] {
  return proposals.map((proposal) => ({
    targetType: proposal.targetType,
    targetId: proposal.targetId,
    label: proposal.label,
    ...(proposal.reason ? { reason: proposal.reason } : {}),
  }));
}

export function serializeAgentReferences(
  items: AgentReferencedItem[],
): DocumentData[] {
  return items.map((item) => ({
    itemType: item.itemType,
    id: item.id,
    title: item.title,
    ...(item.directoryId ? { directoryId: item.directoryId } : {}),
  }));
}

export function agentActionKey(action: AgentActionResult): string {
  return `${action.kind}:${action.entityId ?? action.jobId ?? action.summary}`;
}

export function agentDeleteKey(proposal: AgentProposedDelete): string {
  return `${proposal.targetType}:${proposal.targetId}`;
}

export function agentReferenceKey(item: AgentReferencedItem): string {
  return `${item.itemType}:${item.id}`;
}
