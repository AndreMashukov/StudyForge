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

/**
 * Home folder for a new thread: the directory its first message was sent from
 * (prompt context of type `directory`). Document, rule and no-context chats
 * have none. Independent of the thread's scope.
 */
export function resolveAgentThreadHomeDirectoryId(
  promptContext: z.output<typeof agentPromptContextSchema> | undefined,
): string | undefined {
  return promptContext?.type === 'directory'
    ? promptContext.directoryId
    : undefined;
}

export const agentMessageSchema = z
  .object({
    scope: agentScopeSchema.default('workspace'),
    directoryId: z.string().trim().min(1).optional(),
    message: z.string().trim().min(1, 'Message is required').max(10_000),
    threadId: z.string().trim().min(1).optional(),
    turnId: z.string().trim().min(1).optional(),
    resume: z.boolean().optional(),
    promptContext: agentPromptContextSchema.optional(),
    clientLocalDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'clientLocalDate must be YYYY-MM-DD')
      .optional(),
  })
  .superRefine((value, ctx) => {
    if (value.resume === true) {
      if (!value.turnId) {
        ctx.addIssue({
          code: 'custom',
          message: 'turnId is required when resume is true',
          path: ['turnId'],
        });
      }
      if (!value.threadId) {
        ctx.addIssue({
          code: 'custom',
          message: 'threadId is required when resume is true',
          path: ['threadId'],
        });
      }
    }
  });

export const agentActionKindSchema = z.enum([
  'create_directory',
  'update_directory',
  'move_directory',
  'create_document',
  'update_document',
  'move_document',
  'generate_quiz',
  'generate_flashcards',
  'update_quiz',
  'create_rule',
  'create_rule_from_blueprint',
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

/** Library item kinds an agent turn can surface as a tappable card. */
export const agentReferencedItemTypeSchema = z.enum([
  'directory',
  'document',
  'quiz',
  'flashcard',
  'slideDeck',
  'diagramQuiz',
  'sequenceQuiz',
  'matchQuiz',
]);

/**
 * Referenced item: a library item the agent's tools returned during a turn and
 * the agent chose to present. `id` is the source record id (document id,
 * artifact id, or directory id), never a directory-item index row id.
 */
export const agentReferencedItemSchema = z.object({
  itemType: agentReferencedItemTypeSchema,
  id: z.string().trim().min(1),
  title: z.string(),
  directoryId: z.string().trim().min(1).optional(),
});

/** Limits for clarifying questions the agent asks at the end of a turn. */
export const AGENT_QUESTION_LIMITS = {
  maxQuestions: 4,
  minOptions: 2,
  maxOptions: 4,
  maxQuestionChars: 300,
  maxHeaderChars: 24,
  maxOptionLabelChars: 80,
  maxOptionDescriptionChars: 200,
} as const;

export const agentQuestionOptionSchema = z.object({
  label: z
    .string()
    .trim()
    .min(1)
    .max(AGENT_QUESTION_LIMITS.maxOptionLabelChars),
  description: z
    .string()
    .trim()
    .max(AGENT_QUESTION_LIMITS.maxOptionDescriptionChars)
    .optional(),
  /** The option the agent suggests. At most one per question. */
  recommended: z.boolean().optional(),
});

/**
 * A clarifying question the agent asks instead of guessing. The turn ends with
 * the question; the user's answer arrives as their next message.
 */
export const agentQuestionSchema = z.object({
  id: z.string().trim().min(1).max(40),
  /** Short chip label, e.g. "Folder" or "Format". */
  header: z
    .string()
    .trim()
    .max(AGENT_QUESTION_LIMITS.maxHeaderChars)
    .optional(),
  question: z
    .string()
    .trim()
    .min(1)
    .max(AGENT_QUESTION_LIMITS.maxQuestionChars),
  options: z
    .array(agentQuestionOptionSchema)
    .min(AGENT_QUESTION_LIMITS.minOptions)
    .max(AGENT_QUESTION_LIMITS.maxOptions),
  /** Whether the user may type their own answer instead of picking an option. */
  allowOther: z.boolean().default(true),
});

export const agentMessageResponseSchema = z.object({
  reply: z.string(),
  threadId: z.string().trim().min(1),
  executedActions: z.array(agentActionResultSchema),
  proposedDeletes: z.array(agentProposedDeleteSchema),
  referencedItems: z.array(agentReferencedItemSchema).default([]),
  /** Clarifying questions awaiting the user's answer (asked one at a time). */
  questions: z.array(agentQuestionSchema).default([]),
  retrievedTexts: z.array(z.string()).optional(),
});

export type AgentScope = z.output<typeof agentScopeSchema>;
export type AgentPromptContext = z.output<typeof agentPromptContextSchema>;
export type AgentMessageRequest = z.input<typeof agentMessageSchema>;
export type AgentMessageInput = z.output<typeof agentMessageSchema>;
export type AgentActionKind = z.output<typeof agentActionKindSchema>;
export type AgentDeleteTarget = z.output<typeof agentDeleteTargetSchema>;
export type AgentActionResult = z.output<typeof agentActionResultSchema>;
export type AgentProposedDelete = z.output<typeof agentProposedDeleteSchema>;
export type AgentReferencedItemType = z.output<
  typeof agentReferencedItemTypeSchema
>;
export type AgentReferencedItem = z.output<typeof agentReferencedItemSchema>;
export type AgentQuestionOption = z.output<typeof agentQuestionOptionSchema>;
export type AgentQuestion = z.output<typeof agentQuestionSchema>;
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
    type: z.literal('reference'),
    item: agentReferencedItemSchema,
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
  /**
   * Home folder: the directory the chat was started in (its first message's
   * context was that directory). Set once at creation and never changed;
   * independent of `scope`. Folder Chats tabs list threads by this field.
   */
  homeDirectoryId?: string;
  title?: string;
  preview?: string;
  createdAt: string;
  updatedAt: string;
  lastMessageAt?: string;
  /** Turn still running in this thread, if any (see agent-turn.ts). */
  activeTurnId?: string;
  activeTurnStartedAt?: string;
}

export interface AgentThreadSummary {
  id: string;
  title: string;
  preview?: string;
  scope: AgentScope;
  directoryId?: string;
  homeDirectoryId?: string;
  createdAt: string;
  updatedAt: string;
  lastMessageAt?: string;
  activeTurnId?: string;
  activeTurnStartedAt?: string;
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
  referencedItems?: AgentReferencedItem[];
  /** Assistant messages only: clarifying questions for the user to answer. */
  questions?: AgentQuestion[];
  /** Turn that wrote this message (both roles). */
  turnId?: string;
  /** Assistant messages only: how the turn ended. */
  turnStatus?: 'completed' | 'incomplete' | 'cancelled' | 'failed';
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

export type PlatformAgentKnowledgeDocumentStatus = 'draft' | 'published';

export type PlatformAgentKnowledgeIndexingStatus =
  | 'idle'
  | 'indexing'
  | 'indexed'
  | 'failed';

export interface IPlatformAgentKnowledgeDocument {
  id: string;
  title: string;
  bodyMarkdown: string;
  status: PlatformAgentKnowledgeDocumentStatus;
  tags?: string[];
  updatedAt: string;
  updatedBy?: string;
  publishedAt?: string;
  publishedBy?: string;
  publishedContentHash?: string;
  indexedAt?: string;
  indexingStatus: PlatformAgentKnowledgeIndexingStatus;
  indexingError?: string;
}

export interface IPlatformAgentKnowledgeChunk {
  id: string;
  docId: string;
  docTitle: string;
  text: string;
  contentHash: string;
  sourceContentHash?: string;
  embeddingUserId?: string;
  embeddingRouteKey?: string;
  chunkIndex: number;
  embedding?: number[];
  updatedAt: string;
}

export const platformAgentKnowledgeDocumentFormSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  bodyMarkdown: z.string().trim().min(1, 'Body is required').max(200_000),
  tags: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
});

export const updatePlatformAgentKnowledgeDocumentFormSchema =
  platformAgentKnowledgeDocumentFormSchema.partial();

export type ICreatePlatformAgentKnowledgeDocumentRequest = z.infer<
  typeof platformAgentKnowledgeDocumentFormSchema
>;

export type IUpdatePlatformAgentKnowledgeDocumentRequest = z.infer<
  typeof updatePlatformAgentKnowledgeDocumentFormSchema
>;
