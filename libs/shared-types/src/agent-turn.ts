import { z } from 'zod';
import {
  agentActionResultSchema,
  agentPromptContextSchema,
  agentProposedDeleteSchema,
  agentQuestionSchema,
  agentReferencedItemSchema,
  agentScopeSchema,
} from './agent';

/**
 * Agent turn: one user message plus the agent's work to answer it. It runs in a
 * Cloud Task worker and survives the client closing, so clients follow it
 * through the turn doc at users/{uid}/agentThreads/{threadId}/turns/{turnId}.
 */

/** Client-generated ids (thread and turn). Firestore auto ids and UUIDs both match. */
export const AGENT_CLIENT_ID_PATTERN = /^[A-Za-z0-9_-]{8,100}$/;

export const agentClientIdSchema = z
  .string()
  .trim()
  .regex(AGENT_CLIENT_ID_PATTERN, 'Invalid id');

export const agentTurnStatusSchema = z.enum([
  'queued',
  'running',
  'completed',
  'failed',
  'cancelled',
]);

/** Outcome stored on the assistant message a finished turn writes. */
export const agentMessageTurnStatusSchema = z.enum([
  'completed',
  'incomplete',
  'cancelled',
  'failed',
]);

export const agentTurnErrorCodeSchema = z.enum([
  'internal',
  'deadline',
  'stale',
  'limit',
  'enqueue',
]);

export const agentTurnErrorSchema = z.object({
  code: agentTurnErrorCodeSchema,
  message: z.string(),
});

/** Why a turn was started, when it is not an ordinary chat message. */
export const agentTurnIntentSchema = z.enum(['starter_course']);

export type AgentTurnIntent = z.output<typeof agentTurnIntentSchema>;

const clientLocalDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'clientLocalDate must be YYYY-MM-DD');

export const startAgentTurnRequestSchema = z
  .object({
    scope: agentScopeSchema.default('workspace'),
    directoryId: z.string().trim().min(1).optional(),
    message: z.string().trim().min(1, 'Message is required').max(10_000),
    /** Existing thread id, or a new client-generated id for a new chat. */
    threadId: agentClientIdSchema,
    /** Client-generated; together with threadId it is the idempotency key. */
    turnId: agentClientIdSchema,
    promptContext: agentPromptContextSchema.optional(),
    clientLocalDate: clientLocalDateSchema.optional(),
    /**
     * Starts the free onboarding starter course; the message is the subject.
     * The server decides whether the account may use it.
     */
    intent: agentTurnIntentSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (value.scope === 'directory' && !value.directoryId) {
      ctx.addIssue({
        code: 'custom',
        message: 'directoryId is required for directory scope',
        path: ['directoryId'],
      });
    }
    if (
      value.intent === 'starter_course' &&
      (value.scope !== 'workspace' || value.directoryId || value.promptContext)
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'The starter course runs in workspace scope with nothing open',
        path: ['intent'],
      });
    }
  });

export const startAgentTurnResponseSchema = z.object({
  success: z.literal(true),
  threadId: z.string().trim().min(1),
  turnId: z.string().trim().min(1),
  status: agentTurnStatusSchema,
  /** True when this (threadId, turnId) was already started; nothing new was reserved. */
  alreadyStarted: z.boolean(),
});

export const cancelAgentTurnRequestSchema = z.object({
  threadId: agentClientIdSchema,
  turnId: agentClientIdSchema,
});

export const cancelAgentTurnResponseSchema = z.object({
  success: z.literal(true),
  status: agentTurnStatusSchema,
});

/**
 * Client view of a turn doc. Timestamps are ISO strings (mappers convert
 * Firestore Timestamps before parsing). Server-only fields such as the usage
 * reservation and lease are not part of this view.
 */
export const agentTurnSchema = z.object({
  id: z.string().trim().min(1),
  threadId: z.string().trim().min(1),
  scope: agentScopeSchema.default('workspace'),
  directoryId: z.string().trim().min(1).optional(),
  status: agentTurnStatusSchema,
  incomplete: z.boolean().default(false),
  statusMessage: z.string().nullable().optional(),
  /** Live accumulated reply while running; the final reply once terminal. */
  reply: z.string().default(''),
  /** Increments on every progress flush; a lower value means a reset (retry). */
  replySeq: z.number().int().nonnegative().default(0),
  executedActions: z.array(agentActionResultSchema).default([]),
  proposedDeletes: z.array(agentProposedDeleteSchema).default([]),
  referencedItems: z.array(agentReferencedItemSchema).default([]),
  /** Clarifying questions the finished turn asks the user (set at completion). */
  questions: z.array(agentQuestionSchema).default([]),
  userMessageId: z.string().trim().min(1),
  assistantMessageId: z.string().trim().min(1).nullable().optional(),
  error: agentTurnErrorSchema.nullable().optional(),
  cancelRequested: z.boolean().default(false),
  attempt: z.number().int().nonnegative().default(0),
  createdAt: z.string(),
  updatedAt: z.string(),
  startedAt: z.string().optional(),
  heartbeatAt: z.string().optional(),
  completedAt: z.string().optional(),
});

export type AgentTurnStatus = z.output<typeof agentTurnStatusSchema>;
export type AgentMessageTurnStatus = z.output<
  typeof agentMessageTurnStatusSchema
>;
export type AgentTurnErrorCode = z.output<typeof agentTurnErrorCodeSchema>;
export type AgentTurnError = z.output<typeof agentTurnErrorSchema>;
export type StartAgentTurnRequest = z.input<typeof startAgentTurnRequestSchema>;
export type StartAgentTurnInput = z.output<typeof startAgentTurnRequestSchema>;
export type StartAgentTurnResponse = z.output<
  typeof startAgentTurnResponseSchema
>;
export type CancelAgentTurnRequest = z.output<
  typeof cancelAgentTurnRequestSchema
>;
export type CancelAgentTurnResponse = z.output<
  typeof cancelAgentTurnResponseSchema
>;
export type AgentTurn = z.output<typeof agentTurnSchema>;

/** `failed-precondition` details code when the thread already has a running turn. */
export const AGENT_TURN_IN_PROGRESS_CODE = 'AGENT_TURN_IN_PROGRESS';

/** A running turn with no heartbeat for this long is treated as stuck. */
export const AGENT_TURN_HEARTBEAT_STALE_MS = 90_000;

/** A queued turn not picked up by the worker after this long is treated as stuck. */
export const AGENT_TURN_QUEUED_STALE_MS = 120_000;

const TERMINAL_AGENT_TURN_STATUSES: ReadonlySet<AgentTurnStatus> = new Set([
  'completed',
  'failed',
  'cancelled',
]);

export function isAgentTurnTerminal(status: AgentTurnStatus): boolean {
  return TERMINAL_AGENT_TURN_STATUSES.has(status);
}

export function buildAgentUserMessageId(turnId: string): string {
  return `user-${turnId}`;
}

export function buildAgentAssistantMessageId(turnId: string): string {
  return `assistant-${turnId}`;
}
