import { z } from 'zod';

export const agentScopeSchema = z.enum(['workspace', 'directory']);

export const agentPromptContextSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('directory'),
    directoryId: z.string().trim().min(1),
    label: z.string().trim().min(1).optional(),
    path: z.string().trim().min(1).optional(),
  }),
  z.object({
    type: z.literal('document'),
    documentId: z.string().trim().min(1),
    directoryId: z.string().trim().min(1).optional(),
    label: z.string().trim().min(1).optional(),
    path: z.string().trim().min(1).optional(),
  }),
  z.object({
    type: z.literal('rule'),
    ruleId: z.string().trim().min(1),
    label: z.string().trim().min(1).optional(),
    path: z.string().trim().min(1).optional(),
  }),
]);

export const agentMessageSchema = z.object({
  scope: agentScopeSchema.default('workspace'),
  directoryId: z.string().trim().min(1).optional(),
  message: z.string().trim().min(1, 'Message is required').max(10_000),
  threadId: z.string().trim().min(1).optional(),
  promptContext: agentPromptContextSchema.optional(),
});

export const agentActionKindSchema = z.enum([
  'create_directory',
  'update_directory',
  'move_directory',
  'create_document',
  'update_document',
  'move_document',
  'generate_quiz',
  'update_quiz',
  'create_rule',
  'update_rule',
  'attach_rule',
  'detach_rule',
  'search_knowledge',
]);

export const agentDeleteTargetSchema = z.enum([
  'directory',
  'document',
  'quiz',
  'rule',
]);

export const agentActionResultSchema = z.object({
  kind: agentActionKindSchema,
  summary: z.string(),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  jobId: z.string().optional(),
});

export const agentProposedDeleteSchema = z.object({
  targetType: agentDeleteTargetSchema,
  targetId: z.string().trim().min(1),
  label: z.string(),
  reason: z.string().optional(),
});

export const agentMessageResponseSchema = z.object({
  reply: z.string(),
  threadId: z.string().trim().min(1),
  executedActions: z.array(agentActionResultSchema),
  proposedDeletes: z.array(agentProposedDeleteSchema),
});

export type AgentScope = z.output<typeof agentScopeSchema>;
export type AgentPromptContext = z.output<typeof agentPromptContextSchema>;
export type AgentMessageRequest = z.input<typeof agentMessageSchema>;
export type AgentMessageInput = z.output<typeof agentMessageSchema>;
export type AgentActionKind = z.output<typeof agentActionKindSchema>;
export type AgentDeleteTarget = z.output<typeof agentDeleteTargetSchema>;
export type AgentActionResult = z.output<typeof agentActionResultSchema>;
export type AgentProposedDelete = z.output<typeof agentProposedDeleteSchema>;
export type AgentMessageResponse = z.output<typeof agentMessageResponseSchema>;

export const agentMessageStreamEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('thread'),
    threadId: z.string().trim().min(1),
  }),
  z.object({
    type: z.literal('status'),
    message: z.string(),
  }),
  z.object({
    type: z.literal('delta'),
    text: z.string(),
  }),
  z.object({
    type: z.literal('action'),
    action: agentActionResultSchema,
  }),
  z.object({
    type: z.literal('delete_proposal'),
    proposal: agentProposedDeleteSchema,
  }),
  z.object({
    type: z.literal('done'),
    response: agentMessageResponseSchema,
  }),
  z.object({
    type: z.literal('error'),
    message: z.string(),
  }),
]);

export type AgentMessageStreamEvent = z.output<
  typeof agentMessageStreamEventSchema
>;

export type AgentKnowledgeSourceType =
  | 'directory'
  | 'document'
  | 'quiz'
  | 'rule'
  | 'flashcardSet'
  | 'slideDeck'
  | 'diagramQuiz'
  | 'sequenceQuiz';

export interface IAgentKnowledgeChunk {
  id: string;
  userId: string;
  sourceType: AgentKnowledgeSourceType;
  sourceId: string;
  sourceTitle: string;
  directoryId?: string;
  documentId?: string;
  text: string;
  contentHash: string;
  chunkIndex: number;
  embedding?: number[];
  updatedAt: string;
}

export interface IAgentThread {
  id: string;
  userId: string;
  scope: AgentScope;
  directoryId?: string;
  title?: string;
  preview?: string;
  createdAt: string;
  updatedAt: string;
  lastMessageAt?: string;
}

export interface AgentThreadSummary {
  id: string;
  title: string;
  preview?: string;
  scope: AgentScope;
  directoryId?: string;
  createdAt: string;
  updatedAt: string;
  lastMessageAt?: string;
}

export const getAgentThreadRequestSchema = z.object({
  threadId: z.string().trim().min(1),
});

export const listAgentThreadsRequestSchema = z.object({
  limit: z.number().int().min(1).max(100).optional(),
});

export type GetAgentThreadRequest = z.output<
  typeof getAgentThreadRequestSchema
>;
export type ListAgentThreadsRequest = z.output<
  typeof listAgentThreadsRequestSchema
>;

export interface GetAgentThreadResponse {
  thread: IAgentThread;
  messages: IAgentThreadMessage[];
}

export interface ListAgentThreadsResponse {
  threads: AgentThreadSummary[];
}

export interface IAgentThreadMessage {
  id: string;
  threadId: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  promptContext?: AgentPromptContext;
  executedActions?: AgentActionResult[];
  proposedDeletes?: AgentProposedDelete[];
}

export interface IAgentConversationMemory {
  id: string;
  userId: string;
  threadId: string;
  content: string;
  memoryType: 'preference' | 'fact' | 'instruction' | 'codeword';
  embedding?: number[];
  createdAt: string;
  updatedAt: string;
}
