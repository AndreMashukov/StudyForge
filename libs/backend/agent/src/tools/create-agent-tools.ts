import type {
  AgentActionKind,
  AgentActionResult,
  AgentMessageStreamEvent,
  AgentPromptContext,
  AgentProposedDelete,
  AgentReferencedItem,
  AgentReferencedItemType,
  AgentScope,
  UpdateRuleRequest,
} from '@shared-types';
import {
  agentReferencedItemSchema,
  agentReferencedItemTypeSchema,
  DocumentSourceType,
  RuleColor,
} from '@shared-types';
import { directoryService } from '@study-forge/backend-directories/directory';
import {
  attachRuleToDirectory,
  createRule,
  detachRuleFromDirectory,
  getRule,
  getRules,
  updateRule,
} from '@study-forge/backend-directories/rule-crud';
import {
  createRuleFromBlueprint,
  searchRuleBlueprints,
} from '@study-forge/backend-directories/rule-blueprints';
import { DocumentCrudService } from '@study-forge/backend-documents/document-crud';
import { enqueueGenerationJob } from '@study-forge/backend-generation/generation-enqueue';
import {
  enforceCallableGenerationLimits,
  refundUsageReservationSafe,
} from '@study-forge/backend-generation/generation-limits';
import {
  createPendingQuiz,
  failPendingQuiz,
  createPendingFlashcardSet,
  failPendingFlashcardSet,
} from '@study-forge/backend-artifacts/artifact-generation-records';
import { GenerationJobPayloadStorage } from '@study-forge/backend-generation/generation-job-payload-storage';
import { GenerationJobsService } from '@study-forge/backend-generation/generation-jobs';
import { enqueueGenerationJobTask } from '@study-forge/backend-generation/generation-task-queue';
import type { ArtifactAgentJobPayload } from '@study-forge/backend-artifacts/artifact-definition';
import type { IFlashcardJobPayload } from '@study-forge/backend-artifacts/flashcards';
import {
  getDocumentFallbackColor,
  isAgentPromptApplicability,
} from '@shared-types';
import {
  assertGenerationBatchAllowed,
  AGENT_GENERATION_LIMITS,
  type IAgentGenerationPlanCounts,
} from '../runner/agent-generation-plan';
import { FirestorePaths } from '@study-forge/backend-core/lib/firestore-paths';
import { AgentKnowledgeIndexService } from '../knowledge/agent-knowledge-index-service';
import { AgentKnowledgeLifecycle } from '../knowledge/agent-knowledge-lifecycle';
import { stripHtmlToText } from '../knowledge/knowledge-chunk-utils';
import {
  parseOptionalBoolean,
  parseOptionalRuleApplicabilityArray,
  parseOptionalRuleColor,
  parseRuleApplicabilityArray,
  parseStringArray,
  RULE_APPLICABILITY_ENUM,
  RULE_COLOR_ENUM,
} from './rule-tool-args';
import { createQuizStatisticsToolDefinitions } from './quiz-statistics-tools';
import { throwIfAgentRequestAborted } from '../runner/agent-request-abort';
import {
  claimStarterCourseDocument,
  recordStarterCourseDirectory,
  recordStarterCourseDocument,
  releaseStarterCourseDocument,
} from '@study-forge/backend-core/services/user-onboarding-service';
import {
  attachStarterCourseRules,
  isStarterCourseToolAvailable,
  readShortCooldownSeconds,
  waitForCooldown,
  type IStarterCourseRuntime,
} from './starter-course-tools';

/** Soft cap so tool results stay within model context. */
export const AGENT_DOCUMENT_CONTENT_MAX_CHARS = 60_000;

export interface AgentToolRuntimeContext {
  userId: string;
  scope: AgentScope;
  directoryId?: string;
  directoryIds: string[];
  promptContext?: AgentPromptContext;
  clientLocalDate?: string;
  executedActions: AgentActionResult[];
  proposedDeletes: AgentProposedDelete[];
  /** Items the agent chose to present as cards this turn (via present_items). */
  referencedItems: AgentReferencedItem[];
  /** Items returned by list/get tools this turn; present_items only accepts these. */
  seenItems: Map<string, AgentReferencedItem>;
  generationBatchCounts: IAgentGenerationPlanCounts;
  onEvent?: (event: AgentMessageStreamEvent) => void;
  abortSignal?: AbortSignal;
  /** Set on free onboarding starter-course turns. */
  starterCourse?: IStarterCourseRuntime;
}

export interface AgentToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (args: Record<string, unknown>) => Promise<unknown>;
}

function pushAction(
  context: AgentToolRuntimeContext,
  action: AgentActionResult,
): void {
  context.executedActions.push(action);
  context.onEvent?.({ type: 'action', action });
  if (action.summary.trim().length > 0) {
    context.onEvent?.({ type: 'status', message: action.summary });
  }
}

/** Max cards one turn can present, so a reply never turns into a full listing. */
export const AGENT_MAX_REFERENCED_ITEMS = 8;

export function referencedItemKey(
  itemType: AgentReferencedItemType,
  id: string,
): string {
  return `${itemType}:${id}`;
}

export function rememberSeenItem(
  context: Pick<AgentToolRuntimeContext, 'seenItems'>,
  item: AgentReferencedItem,
): void {
  // Validate here so one malformed record can never break the client's `done` event.
  const parsed = agentReferencedItemSchema.safeParse(item);
  if (!parsed.success) {
    return;
  }
  context.seenItems.set(
    referencedItemKey(parsed.data.itemType, parsed.data.id),
    parsed.data,
  );
}

/**
 * Accept only items a tool already returned this turn. IDs the model writes
 * itself are rejected, so a card can never point at an invented record.
 */
export function presentReferencedItems(
  context: Pick<
    AgentToolRuntimeContext,
    'seenItems' | 'referencedItems' | 'onEvent'
  >,
  requested: Array<{ itemType: AgentReferencedItemType; id: string }>,
): {
  presented: AgentReferencedItem[];
  rejected: string[];
  overLimit: string[];
} {
  const presented: AgentReferencedItem[] = [];
  const rejected: string[] = [];
  const overLimit: string[] = [];
  const already = new Set(
    context.referencedItems.map((item) =>
      referencedItemKey(item.itemType, item.id),
    ),
  );
  for (const request of requested) {
    const key = referencedItemKey(request.itemType, request.id);
    const seen = context.seenItems.get(key);
    if (!seen) {
      rejected.push(key);
      continue;
    }
    if (already.has(key)) {
      continue;
    }
    if (context.referencedItems.length >= AGENT_MAX_REFERENCED_ITEMS) {
      overLimit.push(key);
      continue;
    }
    already.add(key);
    context.referencedItems.push(seen);
    presented.push(seen);
    context.onEvent?.({ type: 'reference', item: seen });
  }
  return { presented, rejected, overLimit };
}

function asRecordArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter(
        (entry): entry is Record<string, unknown> =>
          typeof entry === 'object' && entry !== null,
      )
    : [];
}

function optionalId(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/**
 * After a resumed turn (the Function died mid-run), rebuild what earlier steps
 * saw and presented from the checkpointed tool outcomes, so present_items keeps
 * accepting items listed before the crash and already-shown cards survive.
 */
export function restoreReferencedItemsFromOutcomes(
  context: Pick<AgentToolRuntimeContext, 'seenItems' | 'referencedItems'>,
  checkpointOutcomes: unknown[],
): void {
  const outcomes = asRecordArray(checkpointOutcomes);
  for (const outcome of outcomes) {
    if (outcome.ok !== true) continue;
    const rows =
      outcome.name === 'get_document_content'
        ? asRecordArray([outcome.result])
        : asRecordArray(outcome.result);
    for (const row of rows) {
      const id = optionalId(row.id);
      if (!id) continue;
      if (outcome.name === 'list_directories') {
        rememberSeenItem(context, {
          itemType: 'directory',
          id,
          title: typeof row.name === 'string' ? row.name : '',
          ...(optionalId(row.parentId)
            ? { directoryId: optionalId(row.parentId) }
            : {}),
        });
      } else if (
        outcome.name === 'list_documents' ||
        outcome.name === 'get_document_content'
      ) {
        rememberSeenItem(context, {
          itemType: 'document',
          id,
          title: typeof row.title === 'string' ? row.title : '',
          ...(optionalId(row.directoryId)
            ? { directoryId: optionalId(row.directoryId) }
            : {}),
        });
      } else if (outcome.name === 'list_artifacts') {
        const itemType = agentReferencedItemTypeSchema.safeParse(row.itemType);
        if (itemType.success) {
          rememberSeenItem(context, {
            itemType: itemType.data,
            id,
            title: typeof row.title === 'string' ? row.title : '',
            ...(optionalId(row.directoryId)
              ? { directoryId: optionalId(row.directoryId) }
              : {}),
          });
        }
      }
    }
  }
  const already = new Set(
    context.referencedItems.map((item) =>
      referencedItemKey(item.itemType, item.id),
    ),
  );
  for (const outcome of outcomes) {
    if (outcome.ok !== true || outcome.name !== 'present_items') continue;
    const result = outcome.result;
    const presented =
      typeof result === 'object' && result !== null && 'presented' in result
        ? asRecordArray(result.presented)
        : [];
    for (const row of presented) {
      const itemType = agentReferencedItemTypeSchema.safeParse(row.itemType);
      const id = optionalId(row.id);
      if (!itemType.success || !id) continue;
      const key = referencedItemKey(itemType.data, id);
      const seen = context.seenItems.get(key);
      if (
        seen &&
        !already.has(key) &&
        context.referencedItems.length < AGENT_MAX_REFERENCED_ITEMS
      ) {
        already.add(key);
        context.referencedItems.push(seen);
      }
    }
  }
}

/**
 * Seeds a retried turn with what earlier attempts already did, read from the
 * turn doc: actions, delete proposals and cards survive, and the per-turn
 * generation caps keep counting the jobs already enqueued.
 */
export function seedRuntimeContextFromTurn(
  context: Pick<
    AgentToolRuntimeContext,
    | 'executedActions'
    | 'proposedDeletes'
    | 'referencedItems'
    | 'seenItems'
    | 'generationBatchCounts'
  >,
  seed: {
    executedActions: AgentActionResult[];
    proposedDeletes: AgentProposedDelete[];
    referencedItems: AgentReferencedItem[];
  },
): void {
  context.executedActions.push(...seed.executedActions);
  context.proposedDeletes.push(...seed.proposedDeletes);

  const already = new Set(
    context.referencedItems.map((item) =>
      referencedItemKey(item.itemType, item.id),
    ),
  );
  for (const item of seed.referencedItems) {
    rememberSeenItem(context, item);
    const key = referencedItemKey(item.itemType, item.id);
    if (
      !already.has(key) &&
      context.referencedItems.length < AGENT_MAX_REFERENCED_ITEMS
    ) {
      already.add(key);
      context.referencedItems.push(item);
    }
  }

  for (const action of seed.executedActions) {
    if (action.kind === 'create_document') {
      context.generationBatchCounts.documents += 1;
    } else if (action.kind === 'generate_quiz') {
      context.generationBatchCounts.quizzes += 1;
    } else if (action.kind === 'generate_flashcards') {
      context.generationBatchCounts.flashcardSets += 1;
    }
  }
}

function parsePresentItemsArgs(
  value: unknown,
): Array<{ itemType: AgentReferencedItemType; id: string }> {
  if (!Array.isArray(value)) {
    throw new Error('items must be an array of { itemType, id }');
  }
  return value.flatMap((entry) => {
    if (typeof entry !== 'object' || entry === null) {
      return [];
    }
    const itemType = agentReferencedItemTypeSchema.safeParse(
      'itemType' in entry ? entry.itemType : undefined,
    );
    const id =
      'id' in entry && typeof entry.id === 'string' ? entry.id.trim() : '';
    return itemType.success && id ? [{ itemType: itemType.data, id }] : [];
  });
}

const ARTIFACT_ITEM_TYPES: ReadonlySet<string> = new Set([
  'quiz',
  'flashcard',
  'slideDeck',
  'diagramQuiz',
  'sequenceQuiz',
  'matchQuiz',
]);

function assertDirectoryInScope(
  context: AgentToolRuntimeContext,
  directoryId: string,
): void {
  if (context.scope === 'workspace') {
    return;
  }
  if (!context.directoryIds.includes(directoryId)) {
    throw new Error('Directory is outside the active agent scope');
  }
}

async function resolveDefaultDirectoryId(
  context: AgentToolRuntimeContext,
): Promise<string | undefined> {
  if (
    context.directoryId &&
    context.directoryIds.includes(context.directoryId)
  ) {
    return context.directoryId;
  }
  if (context.promptContext?.type === 'directory') {
    return context.promptContext.directoryId;
  }
  if (
    context.promptContext?.type === 'document' &&
    context.promptContext.directoryId
  ) {
    return context.promptContext.directoryId;
  }
  return context.directoryIds[0];
}

function resolveDefaultDocumentId(
  context: AgentToolRuntimeContext,
): string | undefined {
  if (context.promptContext?.type === 'document') {
    return context.promptContext.documentId;
  }
  return undefined;
}

function truncateAgentText(
  text: string,
  maxChars = AGENT_DOCUMENT_CONTENT_MAX_CHARS,
): {
  text: string;
  truncated: boolean;
  contentLength: number;
} {
  if (text.length <= maxChars) {
    return { text, truncated: false, contentLength: text.length };
  }
  return {
    text: `${text.slice(0, maxChars)}\n\n[truncated: showing first ${maxChars} of ${text.length} characters]`,
    truncated: true,
    contentLength: text.length,
  };
}

export function toAgentReadableDocumentContent(
  content: string,
  contentFormat: string,
): string {
  if (contentFormat === 'html' || content.includes('<')) {
    return stripHtmlToText(content);
  }
  return content.trim();
}

/**
 * Workspace creates default to root. Directory-scoped chats nest under the
 * active directory. Never silently pick the first alphabetized root folder.
 */
/** `parentId` value that asks for a top-level directory in workspace scope. */
export const CREATE_DIRECTORY_ROOT_PARENT = 'root';

function isRootParentArg(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized === CREATE_DIRECTORY_ROOT_PARENT || normalized === '/';
}

/** The directory the user is looking at: the open folder, or the open document's folder. */
function resolveViewedDirectoryId(
  context: AgentToolRuntimeContext,
): string | undefined {
  const promptContext = context.promptContext;
  if (promptContext?.type === 'directory') {
    return promptContext.directoryId;
  }
  if (promptContext?.type === 'document' && promptContext.directoryId) {
    return promptContext.directoryId;
  }
  return undefined;
}

/**
 * Where create_directory puts a new folder:
 * - an explicit parentId wins;
 * - `root` (or `/`) means top level, workspace scope only;
 * - otherwise the folder the user is viewing, like "New folder" in a file
 *   manager; top level only when nothing is open.
 * Directory scope always stays inside the active directory.
 */
export function resolveCreateDirectoryParentId(
  context: AgentToolRuntimeContext,
  args: Record<string, unknown>,
): string | undefined {
  const rawParentId =
    typeof args.parentId === 'string' ? args.parentId.trim() : '';

  if (rawParentId.length > 0 && isRootParentArg(rawParentId)) {
    if (context.scope === 'directory') {
      throw new Error(
        'Directory scope cannot create a top-level directory; omit parentId to create inside the active directory',
      );
    }
    return undefined;
  }

  if (rawParentId.length > 0) {
    assertDirectoryInScope(context, rawParentId);
    return rawParentId;
  }

  if (context.scope === 'directory') {
    if (
      context.directoryId &&
      context.directoryIds.includes(context.directoryId)
    ) {
      return context.directoryId;
    }
    return context.directoryIds[0];
  }

  return resolveViewedDirectoryId(context);
}

function sanitizeDirectoryName(name: string): string {
  return name
    .replace(/[/\\:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const MIN_CREATE_DOCUMENT_PROMPT_CHARS = 10;

function resolveCreateDocumentPrompt(args: Record<string, unknown>): string {
  const prompt = typeof args.prompt === 'string' ? args.prompt.trim() : '';
  if (prompt) {
    return prompt;
  }
  return typeof args.text === 'string' ? args.text.trim() : '';
}

function pendingTitleFromPrompt(prompt: string, title?: string): string {
  if (title) {
    return title;
  }
  return prompt.length > 50 ? `${prompt.substring(0, 50)}…` : prompt;
}

/**
 * Reserves one documentFromPrompt generation. Starter-course documents are
 * free (one claimed slot each). A short generation cooldown is waited out
 * once instead of failing the tool call; the rate limit itself still applies.
 */
async function reserveDocumentGeneration(
  context: AgentToolRuntimeContext,
): Promise<{ reservationId: string; starterClaimed: boolean }> {
  const starter = context.starterCourse;
  let starterClaimed = false;
  if (starter) {
    const claim = await claimStarterCourseDocument(
      context.userId,
      starter.threadId,
    );
    if (claim.allowed === false) {
      throw new Error(claim.message);
    }
    starterClaimed = true;
  }

  const reserve = () =>
    enforceCallableGenerationLimits(
      context.userId,
      'documentFromPrompt',
      undefined,
      starter ? { waiver: { reason: 'starter_course' } } : undefined,
    );

  try {
    try {
      const reservation = await reserve();
      return { reservationId: reservation.id, starterClaimed };
    } catch (error) {
      const waitSeconds = readShortCooldownSeconds(error);
      if (waitSeconds === undefined) {
        throw error;
      }
      context.onEvent?.({
        type: 'status',
        message: `Waiting ${waitSeconds}s before starting the next document...`,
      });
      await waitForCooldown(waitSeconds, context.abortSignal);
      throwIfAgentRequestAborted(context.abortSignal);
      const reservation = await reserve();
      return { reservationId: reservation.id, starterClaimed };
    }
  } catch (error) {
    if (starter && starterClaimed) {
      await releaseStarterCourseDocument(
        context.userId,
        starter.threadId,
      ).catch(() => undefined);
    }
    throw error;
  }
}

export function createAgentToolDefinitions(
  context: AgentToolRuntimeContext,
): AgentToolDefinition[] {
  const definitions: AgentToolDefinition[] = [
    {
      name: 'search_knowledge',
      description:
        'Search indexed StudyForge knowledge using semantic retrieval.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string' },
        },
        required: ['query'],
      },
      execute: async (args) => {
        const query = typeof args.query === 'string' ? args.query.trim() : '';
        if (!query) {
          throw new Error('query is required');
        }
        const results = await AgentKnowledgeIndexService.searchKnowledge({
          userId: context.userId,
          query,
          directoryIds: context.directoryIds,
        });
        pushAction(context, {
          kind: 'search_knowledge',
          summary: `Retrieved ${results.length} knowledge chunks`,
        });
        return results;
      },
    },
    {
      name: 'list_directories',
      description: 'List directories available in the current scope.',
      parameters: { type: 'object', properties: {} },
      execute: async () => {
        const directories = await Promise.all(
          context.directoryIds.map((directoryId) =>
            directoryService.getDirectory(context.userId, directoryId),
          ),
        );
        const found = directories.filter(
          (directory): directory is NonNullable<typeof directory> =>
            Boolean(directory),
        );
        for (const directory of found) {
          rememberSeenItem(context, {
            itemType: 'directory',
            id: directory.id,
            title: directory.name,
            ...(directory.parentId ? { directoryId: directory.parentId } : {}),
          });
        }
        return found;
      },
    },
    {
      name: 'list_documents',
      description:
        'List document metadata in scope. Pass directoryId to focus on one folder (recommended when UI context is a directory). Does not include document body content; use get_document_content next.',
      parameters: {
        type: 'object',
        properties: {
          directoryId: { type: 'string' },
        },
      },
      execute: async (args) => {
        const requestedDirectoryId =
          typeof args.directoryId === 'string' &&
          args.directoryId.trim().length > 0
            ? args.directoryId.trim()
            : undefined;
        const targetDirectoryIds = requestedDirectoryId
          ? [requestedDirectoryId]
          : context.directoryIds;

        if (requestedDirectoryId) {
          assertDirectoryInScope(context, requestedDirectoryId);
        }

        const snapshots = await Promise.all(
          targetDirectoryIds.map((directoryId) =>
            FirestorePaths.documents(context.userId)
              .where('directoryId', '==', directoryId)
              .get(),
          ),
        );
        const documents = snapshots.flatMap((snapshot) =>
          snapshot.docs.map((doc) => {
            const data = doc.data();
            return {
              id: doc.id,
              title: typeof data.title === 'string' ? data.title : '',
              directoryId:
                typeof data.directoryId === 'string'
                  ? data.directoryId
                  : undefined,
              description:
                typeof data.description === 'string'
                  ? data.description
                  : undefined,
              sourceType:
                typeof data.sourceType === 'string'
                  ? data.sourceType
                  : undefined,
              updatedAt: data.updatedAt ?? undefined,
            };
          }),
        );
        for (const document of documents) {
          rememberSeenItem(context, {
            itemType: 'document',
            id: document.id,
            title: document.title,
            ...(document.directoryId
              ? { directoryId: document.directoryId }
              : {}),
          });
        }
        return documents;
      },
    },
    {
      name: 'get_document_content',
      description:
        'Read the full body of a document. Required before explaining, summarizing, extracting, or rewriting material from an existing document. If documentId is omitted and UI context is a document, uses that document.',
      parameters: {
        type: 'object',
        properties: {
          documentId: { type: 'string' },
        },
      },
      execute: async (args) => {
        const documentId =
          typeof args.documentId === 'string' &&
          args.documentId.trim().length > 0
            ? args.documentId.trim()
            : resolveDefaultDocumentId(context);
        if (!documentId) {
          throw new Error(
            'documentId is required when no document UI context is active',
          );
        }

        const document = await DocumentCrudService.getDocumentWithContent(
          context.userId,
          documentId,
        );
        if (!document.directoryId) {
          throw new Error('Document is missing a directoryId');
        }
        assertDirectoryInScope(context, document.directoryId);

        const readable = toAgentReadableDocumentContent(
          document.content,
          document.contentFormat,
        );
        const truncated = truncateAgentText(readable);
        rememberSeenItem(context, {
          itemType: 'document',
          id: document.id,
          title: document.title,
          directoryId: document.directoryId,
        });

        return {
          id: document.id,
          title: document.title,
          directoryId: document.directoryId,
          contentFormat: document.contentFormat,
          content: truncated.text,
          truncated: truncated.truncated,
          contentLength: truncated.contentLength,
        };
      },
    },
    {
      name: 'list_quizzes',
      description: 'List quizzes in scope.',
      parameters: { type: 'object', properties: {} },
      execute: async () => {
        const snapshot = await FirestorePaths.quizzes(context.userId).get();
        return snapshot.docs
          .map((doc) => {
            const data = doc.data();
            return {
              id: doc.id,
              directoryId:
                typeof data.directoryId === 'string'
                  ? data.directoryId
                  : undefined,
            };
          })
          .filter((quiz) =>
            quiz.directoryId
              ? context.directoryIds.includes(quiz.directoryId)
              : true,
          );
      },
    },
    {
      name: 'list_artifacts',
      description:
        'List study artifacts (quizzes, flashcard sets, slide decks, diagram/sequence/match quizzes) with titles and types. Pass directoryId to focus on one folder; omit it to list every folder in scope.',
      parameters: {
        type: 'object',
        properties: {
          directoryId: { type: 'string' },
        },
      },
      execute: async (args) => {
        const requestedDirectoryId =
          typeof args.directoryId === 'string' &&
          args.directoryId.trim().length > 0
            ? args.directoryId.trim()
            : undefined;
        // The id becomes a Firestore path segment, so accept only known directories in every scope.
        if (
          requestedDirectoryId &&
          !context.directoryIds.includes(requestedDirectoryId)
        ) {
          throw new Error('Directory is outside the active agent scope');
        }
        const targetDirectoryIds = requestedDirectoryId
          ? [requestedDirectoryId]
          : context.directoryIds;
        const snapshots = await Promise.all(
          targetDirectoryIds.map((directoryId) =>
            FirestorePaths.directoryItems(context.userId, directoryId).get(),
          ),
        );
        const artifacts = snapshots.flatMap((snapshot, index) =>
          snapshot.docs.flatMap((doc) => {
            const data = doc.data();
            const itemType =
              typeof data.itemType === 'string' ? data.itemType : '';
            const parsedType =
              agentReferencedItemTypeSchema.safeParse(itemType);
            if (!ARTIFACT_ITEM_TYPES.has(itemType) || !parsedType.success) {
              return [];
            }
            const id = typeof data.sourceId === 'string' ? data.sourceId : '';
            if (!id) {
              return [];
            }
            return [
              {
                itemType: parsedType.data,
                id,
                title: typeof data.title === 'string' ? data.title : '',
                directoryId: targetDirectoryIds[index],
                generationStatus:
                  typeof data.generationStatus === 'string'
                    ? data.generationStatus
                    : undefined,
              },
            ];
          }),
        );
        for (const artifact of artifacts) {
          rememberSeenItem(context, {
            itemType: artifact.itemType,
            id: artifact.id,
            title: artifact.title,
            directoryId: artifact.directoryId,
          });
        }
        return artifacts;
      },
    },
    {
      name: 'present_items',
      description:
        'Show specific directories, documents, or artifacts to the user as tappable cards. Use whenever the user asks to find, open, show, or pick items. Only items returned by list_directories, list_documents, list_artifacts, or get_document_content earlier in this turn are accepted; call those first. Pass the itemType and id exactly as those tools returned them. At most 8 items.',
      parameters: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                itemType: {
                  type: 'string',
                  enum: agentReferencedItemTypeSchema.options,
                },
                id: { type: 'string' },
              },
              required: ['itemType', 'id'],
            },
          },
        },
        required: ['items'],
      },
      execute: async (args) => {
        const requested = parsePresentItemsArgs(args.items);
        const result = presentReferencedItems(context, requested);
        return {
          presented: result.presented.map((item) => ({
            itemType: item.itemType,
            id: item.id,
            title: item.title,
          })),
          rejected: result.rejected,
          ...(result.overLimit.length > 0
            ? {
                overLimit: result.overLimit,
                limitNote: `Only ${AGENT_MAX_REFERENCED_ITEMS} cards can be shown per reply; mention the rest by name.`,
              }
            : {}),
          ...(result.rejected.length > 0
            ? {
                note: 'Rejected items were not returned by a list or get tool this turn. List them first, then present again.',
              }
            : {}),
        };
      },
    },
    ...createQuizStatisticsToolDefinitions(context),
    {
      name: 'list_rules',
      description: 'List user rules.',
      parameters: { type: 'object', properties: {} },
      execute: async () => getRules(context.userId),
    },
    {
      name: 'search_rule_blueprints',
      description:
        'Search published platform rule blueprints. Use this before creating rules so you base new rules on canonical templates, not existing user-editable rules.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          applicableTo: { type: 'string', enum: RULE_APPLICABILITY_ENUM },
          tags: { type: 'array', items: { type: 'string' } },
          limit: { type: 'number' },
        },
      },
      execute: async (args) => {
        const query = typeof args.query === 'string' ? args.query.trim() : '';
        const applicableTo =
          typeof args.applicableTo === 'string'
            ? parseRuleApplicabilityArray([args.applicableTo])[0]
            : undefined;
        const tags =
          args.tags === undefined
            ? undefined
            : parseStringArray(args.tags, 'tags');
        const limit =
          typeof args.limit === 'number' && Number.isFinite(args.limit)
            ? Math.floor(args.limit)
            : undefined;
        return searchRuleBlueprints({
          query: query || undefined,
          applicableTo,
          tags,
          limit,
        });
      },
    },
    {
      name: 'create_directory',
      description:
        'Create a directory. Omit parentId to create inside the folder the user is viewing (the open folder, or the open document\'s folder); with nothing open it goes at the workspace root. Pass parentId "root" only when the user asks for a top-level folder, or another directory id to nest under that directory. In directory scope it always stays inside the active directory. Directory names cannot contain / \\ : * ? " < > |; slashes in topics like AI/ML are converted to hyphens automatically.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          parentId: { type: 'string' },
          description: { type: 'string' },
        },
        required: ['name'],
      },
      execute: async (args) => {
        const rawName = typeof args.name === 'string' ? args.name.trim() : '';
        const name = sanitizeDirectoryName(rawName);
        if (!name) {
          throw new Error('name is required');
        }
        const parentId = resolveCreateDirectoryParentId(context, args);
        context.onEvent?.({
          type: 'status',
          message: `Creating directory "${name}"...`,
        });
        const directory = await directoryService.createDirectory(
          context.userId,
          {
            name,
            parentId: parentId ?? undefined,
            description:
              typeof args.description === 'string'
                ? args.description
                : undefined,
          },
        );
        // Record the action as soon as the write lands, so a Stop during
        // indexing still reports the directory that now exists.
        pushAction(context, {
          kind: 'create_directory',
          summary: `Created directory "${directory.name}" at ${directory.path}`,
          entityType: 'directory',
          entityId: directory.id,
        });
        const starter = context.starterCourse;
        if (starter && !starter.directoryId) {
          const recorded = await recordStarterCourseDirectory(
            context.userId,
            starter.threadId,
            directory.id,
          );
          if (recorded) {
            starter.directoryId = directory.id;
            await attachStarterCourseRules(context.userId, directory.id);
          }
        }
        await AgentKnowledgeLifecycle.indexDirectory(
          context.userId,
          directory.id,
        );
        return directory;
      },
    },
    {
      name: 'create_document',
      description:
        'Enqueue documentFromPrompt to generate a study document. Pass source text only in prompt (the material to transform or the topic). Do not paste rule bodies or write HTML or markdown yourself. Directory rules are injected by the generation pipeline.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          prompt: { type: 'string' },
          directoryId: { type: 'string' },
        },
        required: ['prompt'],
      },
      execute: async (args) => {
        const prompt = resolveCreateDocumentPrompt(args);
        const titleArg =
          typeof args.title === 'string' ? args.title.trim() : '';
        const starter = context.starterCourse;
        const directoryId =
          typeof args.directoryId === 'string' && args.directoryId.trim()
            ? args.directoryId.trim()
            : (starter?.directoryId ?? (await resolveDefaultDirectoryId(context)));
        if (!prompt || !directoryId) {
          throw new Error('prompt and directoryId are required');
        }
        if (starter && directoryId === starter.sampleDirectoryId) {
          throw new Error(
            'Do not add the starter course to the sample folder. Create the course folder first, then pass its id.',
          );
        }
        if (prompt.length < MIN_CREATE_DOCUMENT_PROMPT_CHARS) {
          throw new Error(
            `prompt must be at least ${MIN_CREATE_DOCUMENT_PROMPT_CHARS} characters`,
          );
        }
        assertDirectoryInScope(context, directoryId);
        assertGenerationBatchAllowed(context.generationBatchCounts, {
          documents: 1,
        });
        const title = pendingTitleFromPrompt(prompt, titleArg || undefined);
        context.onEvent?.({
          type: 'status',
          message: `Starting document "${title}"...`,
        });
        throwIfAgentRequestAborted(context.abortSignal);
        const { reservationId: usageReservationId, starterClaimed } =
          await reserveDocumentGeneration(context);
        let pendingDocId: string | undefined;
        try {
          throwIfAgentRequestAborted(context.abortSignal);
          pendingDocId = await DocumentCrudService.createPendingDocument(
            context.userId,
            {
              directoryId,
              title,
              description: `Generated from prompt: ${prompt.substring(0, 100)}${
                prompt.length > 100 ? '...' : ''
              }`,
              sourceType: DocumentSourceType.GENERATED,
              tags: ['ai-generated', 'prompt-based'],
            },
          );
          throwIfAgentRequestAborted(context.abortSignal);
          const jobId = await enqueueGenerationJob({
            userId: context.userId,
            directoryId,
            recordId: pendingDocId,
            kind: 'documentFromPrompt',
            usageReservationId,
            payload: {
              sourceKind: 'prompt',
              prompt,
              title,
              directoryId,
              ruleResolutionMode: 'inherit-plus-explicit',
            },
          });
          pushAction(context, {
            kind: 'create_document',
            summary: `Started document generation for "${title}"`,
            entityType: 'document',
            entityId: pendingDocId,
            jobId,
          });
          context.generationBatchCounts.documents += 1;
          if (starter && starterClaimed) {
            await recordStarterCourseDocument(context.userId, pendingDocId);
            starter.documentsRemaining = Math.max(
              0,
              starter.documentsRemaining - 1,
            );
          }
          return {
            id: pendingDocId,
            documentId: pendingDocId,
            title,
            jobId,
            generationStatus: 'pending',
            ruleResolutionMode: 'inherit-plus-explicit',
          };
        } catch (error) {
          if (pendingDocId) {
            const message =
              error instanceof Error ? error.message : String(error);
            await DocumentCrudService.failPendingDocument(
              context.userId,
              pendingDocId,
              message,
            ).catch(() => undefined);
          }
          await refundUsageReservationSafe(context.userId, usageReservationId);
          if (starter && starterClaimed) {
            await releaseStarterCourseDocument(
              context.userId,
              starter.threadId,
            ).catch(() => undefined);
          }
          throw error;
        }
      },
    },
    {
      name: 'generate_quiz',
      description:
        'Generate a quiz from a document. Uses the same quiz credit cost as the quiz generator in the app.',
      parameters: {
        type: 'object',
        properties: {
          documentId: { type: 'string' },
          title: { type: 'string' },
          questionCount: { type: 'number' },
        },
        required: ['documentId'],
      },
      execute: async (args) => {
        const documentId =
          typeof args.documentId === 'string' ? args.documentId : '';
        if (!documentId) {
          throw new Error('documentId is required');
        }
        const document = await DocumentCrudService.getDocument(
          context.userId,
          documentId,
        );
        if (!document?.directoryId) {
          throw new Error('Document not found');
        }
        assertDirectoryInScope(context, document.directoryId);
        assertGenerationBatchAllowed(context.generationBatchCounts, {
          quizzes: 1,
        });
        const title =
          typeof args.title === 'string'
            ? args.title
            : `${document.title} Quiz`;
        throwIfAgentRequestAborted(context.abortSignal);
        const usageReservation = await enforceCallableGenerationLimits(
          context.userId,
          'quiz',
        );
        let quizId: string | undefined;
        try {
          throwIfAgentRequestAborted(context.abortSignal);
          quizId = await createPendingQuiz({
            userId: context.userId,
            directoryId: document.directoryId,
            documentId,
            documentIds: [documentId],
            documentTitle: document.title,
            title,
          });
          throwIfAgentRequestAborted(context.abortSignal);
          const jobId = await enqueueGenerationJob({
            userId: context.userId,
            directoryId: document.directoryId,
            recordId: quizId,
            kind: 'quiz',
            usageReservationId: usageReservation.id,
            payload: {
              documentIds: [documentId],
              title,
              questionCount:
                typeof args.questionCount === 'number'
                  ? Math.min(args.questionCount, 20)
                  : 10,
            },
          });
          pushAction(context, {
            kind: 'generate_quiz',
            summary: `Started quiz generation for "${document.title}"`,
            entityType: 'quiz',
            entityId: quizId,
            jobId,
          });
          context.generationBatchCounts.quizzes += 1;
          return { quizId, jobId };
        } catch (error) {
          if (quizId) {
            const message =
              error instanceof Error ? error.message : String(error);
            await failPendingQuiz(context.userId, quizId, message).catch(
              () => undefined,
            );
          }
          await refundUsageReservationSafe(context.userId, usageReservation.id);
          throw error;
        }
      },
    },
    {
      name: 'generate_flashcards',
      description:
        'Generate a flashcard set from one or more documents in the same directory. Uses the flashcards credit cost and artifact agent pipeline.',
      parameters: {
        type: 'object',
        properties: {
          documentIds: {
            type: 'array',
            items: { type: 'string' },
          },
          directoryId: { type: 'string' },
          title: { type: 'string' },
          additionalPrompt: { type: 'string' },
        },
        required: ['documentIds'],
      },
      execute: async (args) => {
        const documentIds = parseStringArray(args.documentIds, 'documentIds');
        if (documentIds.length === 0) {
          throw new Error('documentIds must include at least one document');
        }
        if (
          documentIds.length >
          AGENT_GENERATION_LIMITS.maxSourceDocumentsPerFlashcardSet
        ) {
          throw new Error(
            `Maximum ${AGENT_GENERATION_LIMITS.maxSourceDocumentsPerFlashcardSet} source documents per flashcard set`,
          );
        }

        const documentDataList = await Promise.all(
          documentIds.map(async (documentId) => {
            const document = await DocumentCrudService.getDocumentWithContent(
              context.userId,
              documentId,
            );
            if (!document?.content || !document.directoryId) {
              throw new Error(
                `Document not found or has no content: ${documentId}`,
              );
            }
            return document;
          }),
        );

        const resolvedDirectoryId =
          typeof args.directoryId === 'string' &&
          args.directoryId.trim().length > 0
            ? args.directoryId.trim()
            : documentDataList[0]?.directoryId;
        if (!resolvedDirectoryId) {
          throw new Error('directoryId is required');
        }
        assertDirectoryInScope(context, resolvedDirectoryId);
        await directoryService.validateDirectoryId(
          context.userId,
          resolvedDirectoryId,
        );
        for (const document of documentDataList) {
          if (document.directoryId !== resolvedDirectoryId) {
            throw new Error('All documents must belong to the same directory');
          }
        }

        assertGenerationBatchAllowed(context.generationBatchCounts, {
          flashcardSets: 1,
        });

        const customTitle =
          typeof args.title === 'string' ? args.title.trim() : '';
        const pendingTitle =
          customTitle ||
          (documentIds.length === 1
            ? `Flashcards for "${documentDataList[0].title}"`
            : `Flashcards for "${documentDataList[0].title}" + ${documentIds.length - 1} more`);
        const additionalPrompt =
          typeof args.additionalPrompt === 'string'
            ? args.additionalPrompt.trim()
            : undefined;

        throwIfAgentRequestAborted(context.abortSignal);
        const usageReservation = await enforceCallableGenerationLimits(
          context.userId,
          'flashcards',
        );
        let flashcardSetId: string | undefined;
        try {
          throwIfAgentRequestAborted(context.abortSignal);
          flashcardSetId = await createPendingFlashcardSet({
            userId: context.userId,
            directoryId: resolvedDirectoryId,
            documentId: documentIds[0],
            documentIds: documentIds.length > 1 ? documentIds : undefined,
            documentTitle: documentDataList[0].title,
            title: pendingTitle,
            documentColor:
              documentDataList[0].color ??
              getDocumentFallbackColor(documentDataList[0].id),
            documentColors:
              documentDataList.length > 1
                ? documentDataList.map(
                    (document) =>
                      document.color ?? getDocumentFallbackColor(document.id),
                  )
                : undefined,
          });

          const jobId = GenerationJobsService.newJobId(context.userId);
          const payload: ArtifactAgentJobPayload<IFlashcardJobPayload> = {
            artifactKind: 'flashcards',
            documentIds,
            directoryId: resolvedDirectoryId,
            recordId: flashcardSetId,
            title: pendingTitle,
            additionalPrompt: additionalPrompt || undefined,
            ruleResolutionMode: 'inherit-plus-explicit',
            artifactPayload: {},
          };
          throwIfAgentRequestAborted(context.abortSignal);
          const payloadStoragePath = await GenerationJobPayloadStorage.saveJson(
            context.userId,
            jobId,
            payload,
          );
          await GenerationJobsService.createJob({
            jobId,
            kind: 'artifactAgent',
            userId: context.userId,
            directoryId: resolvedDirectoryId,
            recordId: flashcardSetId,
            payloadStoragePath,
            artifactKind: 'flashcards',
            usageReservationId: usageReservation.id,
          });
          await enqueueGenerationJobTask({ userId: context.userId, jobId });

          pushAction(context, {
            kind: 'generate_flashcards',
            summary: `Started flashcard generation for "${pendingTitle}"`,
            entityType: 'flashcardSet',
            entityId: flashcardSetId,
            jobId,
          });
          context.generationBatchCounts.flashcardSets += 1;
          return { flashcardSetId, jobId };
        } catch (error) {
          if (flashcardSetId) {
            const message =
              error instanceof Error ? error.message : String(error);
            await failPendingFlashcardSet(
              context.userId,
              flashcardSetId,
              message,
            ).catch(() => undefined);
          }
          await refundUsageReservationSafe(context.userId, usageReservation.id);
          throw error;
        }
      },
    },
    {
      name: 'create_rule',
      description:
        'Create a reusable rule from scratch. Prefer create_rule_from_blueprint when a published blueprint matches the request. With applicableTo ["agent"] it saves an agent prompt: a request the user runs later by typing "/" in the agent chat (global, never attached to folders, at most 10,000 characters, and "agent" cannot be combined with other values).',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          content: { type: 'string' },
          description: { type: 'string' },
          color: { type: 'string', enum: RULE_COLOR_ENUM },
          tags: { type: 'array', items: { type: 'string' } },
          applicableTo: {
            type: 'array',
            description:
              'Generation types the rule applies to. Required: choose at least one. Use ["agent"] alone for an agent prompt.',
            items: { type: 'string', enum: RULE_APPLICABILITY_ENUM },
          },
        },
        required: ['name', 'content', 'applicableTo'],
      },
      execute: async (args) => {
        const name = typeof args.name === 'string' ? args.name.trim() : '';
        const content =
          typeof args.content === 'string' ? args.content.trim() : '';
        if (!name || !content) {
          throw new Error('name and content are required');
        }
        if (args.applicableTo === undefined) {
          throw new Error(
            `applicableTo is required: pass at least one of ${RULE_APPLICABILITY_ENUM.join(', ')}`,
          );
        }

        const applicableTo = parseRuleApplicabilityArray(args.applicableTo);

        const rule = await createRule(context.userId, {
          name,
          content,
          description:
            typeof args.description === 'string' ? args.description : '',
          color:
            args.color === undefined
              ? RuleColor.PURPLE
              : (parseOptionalRuleColor(args.color) ?? RuleColor.PURPLE),
          tags: args.tags === undefined ? [] : parseStringArray(args.tags),
          applicableTo,
        });
        pushAction(context, {
          kind: 'create_rule',
          summary: isAgentPromptApplicability(rule.applicableTo)
            ? `Saved prompt "${rule.name}" (type / to run it)`
            : `Created prompt "${rule.name}"`,
          entityType: 'rule',
          entityId: rule.id,
        });
        await AgentKnowledgeLifecycle.indexRule(context.userId, rule.id);
        return rule;
      },
    },
    {
      name: 'create_rule_from_blueprint',
      description:
        'Create a user rule from a published platform blueprint. Search blueprints first, read the template, then pass a customized name and content variant. Optionally attach to a directory in the same call.',
      parameters: {
        type: 'object',
        properties: {
          blueprintId: { type: 'string' },
          name: { type: 'string' },
          content: { type: 'string' },
          description: { type: 'string' },
          color: { type: 'string', enum: RULE_COLOR_ENUM },
          tags: { type: 'array', items: { type: 'string' } },
          applicableTo: {
            type: 'array',
            items: { type: 'string', enum: RULE_APPLICABILITY_ENUM },
          },
          directoryId: { type: 'string' },
          alwaysApply: {
            type: 'boolean',
            description:
              'With directoryId: the attached rule applies by default in that folder and its subfolders. Pass false to attach it switched off by default.',
          },
        },
        required: ['blueprintId', 'name', 'content'],
      },
      execute: async (args) => {
        const blueprintId =
          typeof args.blueprintId === 'string' ? args.blueprintId.trim() : '';
        const name = typeof args.name === 'string' ? args.name.trim() : '';
        const content =
          typeof args.content === 'string' ? args.content.trim() : '';
        if (!blueprintId || !name || !content) {
          throw new Error('blueprintId, name, and content are required');
        }

        const directoryId =
          typeof args.directoryId === 'string'
            ? args.directoryId.trim()
            : undefined;
        if (directoryId) {
          assertDirectoryInScope(context, directoryId);
        }

        const applicableTo =
          args.applicableTo === undefined
            ? undefined
            : parseRuleApplicabilityArray(args.applicableTo);

        const rule = await createRuleFromBlueprint(context.userId, {
          blueprintId,
          name,
          content,
          description:
            typeof args.description === 'string' ? args.description : undefined,
          color:
            args.color === undefined
              ? undefined
              : (parseOptionalRuleColor(args.color) ?? undefined),
          tags:
            args.tags === undefined
              ? undefined
              : parseStringArray(args.tags, 'tags'),
          applicableTo,
          directoryId,
          alwaysApply:
            parseOptionalBoolean(args.alwaysApply, 'alwaysApply') ?? true,
        });
        pushAction(context, {
          kind: 'create_rule_from_blueprint',
          summary: `Created prompt "${rule.name}" from a template`,
          entityType: 'rule',
          entityId: rule.id,
        });
        await AgentKnowledgeLifecycle.indexRule(context.userId, rule.id);
        return rule;
      },
    },
    {
      name: 'update_rule',
      description:
        'Update an existing rule. Provide ruleId and any fields to change (name, description, content, color, tags, applicableTo). Whether a rule applies by default is set per folder with attach_rule_to_directory.',
      parameters: {
        type: 'object',
        properties: {
          ruleId: { type: 'string' },
          name: { type: 'string' },
          description: { type: 'string' },
          content: { type: 'string' },
          color: { type: 'string', enum: RULE_COLOR_ENUM },
          tags: { type: 'array', items: { type: 'string' } },
          applicableTo: {
            type: 'array',
            items: { type: 'string', enum: RULE_APPLICABILITY_ENUM },
          },
        },
        required: ['ruleId'],
      },
      execute: async (args) => {
        const ruleId =
          typeof args.ruleId === 'string' ? args.ruleId.trim() : '';
        if (!ruleId) {
          throw new Error('ruleId is required');
        }

        const updateRequest: UpdateRuleRequest = { ruleId };

        if (args.name !== undefined) {
          if (typeof args.name !== 'string' || args.name.trim().length === 0) {
            throw new Error('name must be a non-empty string');
          }
          updateRequest.name = args.name.trim();
        }
        if (args.description !== undefined) {
          if (typeof args.description !== 'string') {
            throw new Error('description must be a string');
          }
          updateRequest.description = args.description;
        }
        if (args.content !== undefined) {
          if (
            typeof args.content !== 'string' ||
            args.content.trim().length === 0
          ) {
            throw new Error('content must be a non-empty string');
          }
          updateRequest.content = args.content;
        }
        if (args.color !== undefined) {
          updateRequest.color = parseOptionalRuleColor(args.color);
        }
        if (args.tags !== undefined) {
          updateRequest.tags = parseStringArray(args.tags);
        }
        if (args.applicableTo !== undefined) {
          updateRequest.applicableTo = parseOptionalRuleApplicabilityArray(
            args.applicableTo,
          );
        }

        const hasUpdates =
          updateRequest.name !== undefined ||
          updateRequest.description !== undefined ||
          updateRequest.content !== undefined ||
          updateRequest.color !== undefined ||
          updateRequest.tags !== undefined ||
          updateRequest.applicableTo !== undefined;

        if (!hasUpdates) {
          throw new Error('Provide at least one field to update');
        }

        const rule = await updateRule(context.userId, updateRequest);
        pushAction(context, {
          kind: 'update_rule',
          summary: `Updated prompt "${rule.name}"`,
          entityType: 'rule',
          entityId: rule.id,
        });
        await AgentKnowledgeLifecycle.indexRule(context.userId, rule.id);
        return rule;
      },
    },
    {
      name: 'attach_rule_to_directory',
      description:
        'Attach a rule to a directory. An attached rule applies by default to everything generated in that folder and its subfolders. Pass alwaysApply false to attach it switched off by default (it can still be picked for a single generation).',
      parameters: {
        type: 'object',
        properties: {
          directoryId: { type: 'string' },
          ruleId: { type: 'string' },
          alwaysApply: { type: 'boolean' },
        },
        required: ['directoryId', 'ruleId'],
      },
      execute: async (args) => {
        const directoryId =
          typeof args.directoryId === 'string' ? args.directoryId : '';
        const ruleId = typeof args.ruleId === 'string' ? args.ruleId : '';
        if (!directoryId || !ruleId) {
          throw new Error('directoryId and ruleId are required');
        }
        assertDirectoryInScope(context, directoryId);
        const alwaysApply =
          parseOptionalBoolean(args.alwaysApply, 'alwaysApply') ?? true;
        await attachRuleToDirectory(context.userId, ruleId, directoryId, {
          alwaysApply,
        });
        const directory = await directoryService.getDirectory(
          context.userId,
          directoryId,
        );
        const directoryLabel = directory?.path ?? directoryId;
        pushAction(context, {
          kind: 'attach_rule',
          summary: `Attached prompt to ${directoryLabel}`,
          entityType: 'rule',
          entityId: ruleId,
        });
        return { directoryId, ruleId, directoryPath: directory?.path };
      },
    },
    {
      name: 'detach_rule_from_directory',
      description: 'Detach a rule from a directory.',
      parameters: {
        type: 'object',
        properties: {
          directoryId: { type: 'string' },
          ruleId: { type: 'string' },
        },
        required: ['directoryId', 'ruleId'],
      },
      execute: async (args) => {
        const directoryId =
          typeof args.directoryId === 'string' ? args.directoryId : '';
        const ruleId = typeof args.ruleId === 'string' ? args.ruleId : '';
        if (!directoryId || !ruleId) {
          throw new Error('directoryId and ruleId are required');
        }
        assertDirectoryInScope(context, directoryId);
        await detachRuleFromDirectory(context.userId, ruleId, directoryId);
        pushAction(context, {
          kind: 'detach_rule',
          summary: 'Detached prompt from directory',
          entityType: 'rule',
          entityId: ruleId,
        });
        return { directoryId, ruleId };
      },
    },
    {
      name: 'propose_delete_rule',
      description: 'Propose deleting a rule for user confirmation.',
      parameters: {
        type: 'object',
        properties: {
          ruleId: { type: 'string' },
          reason: { type: 'string' },
        },
        required: ['ruleId'],
      },
      execute: async (args) => {
        const ruleId =
          typeof args.ruleId === 'string' ? args.ruleId.trim() : '';
        if (!ruleId) {
          throw new Error('ruleId is required');
        }

        const rule = await getRule(context.userId, ruleId);
        if (!rule) {
          throw new Error('Rule not found');
        }

        context.proposedDeletes.push({
          targetType: 'rule',
          targetId: ruleId,
          label: rule.name,
          ...(typeof args.reason === 'string' ? { reason: args.reason } : {}),
        });
        return { proposed: true };
      },
    },
    {
      name: 'propose_delete_directory',
      description: 'Propose deleting a directory for user confirmation.',
      parameters: {
        type: 'object',
        properties: {
          directoryId: { type: 'string' },
          reason: { type: 'string' },
        },
        required: ['directoryId'],
      },
      execute: async (args) => {
        const directoryId =
          typeof args.directoryId === 'string' ? args.directoryId : '';
        const directory = await directoryService.getDirectory(
          context.userId,
          directoryId,
        );
        if (!directory) {
          throw new Error('Directory not found');
        }
        context.proposedDeletes.push({
          targetType: 'directory',
          targetId: directoryId,
          label: directory.name,
          ...(typeof args.reason === 'string' ? { reason: args.reason } : {}),
        });
        return { proposed: true };
      },
    },
    {
      name: 'propose_delete_documents',
      description:
        'Propose deleting one or more documents for user confirmation.',
      parameters: {
        type: 'object',
        properties: {
          documentIds: { type: 'array', items: { type: 'string' } },
          reason: { type: 'string' },
        },
        required: ['documentIds'],
      },
      execute: async (args) => {
        const documentIds = Array.isArray(args.documentIds)
          ? args.documentIds.filter(
              (value): value is string => typeof value === 'string',
            )
          : [];
        for (const documentId of documentIds) {
          const document = await DocumentCrudService.getDocument(
            context.userId,
            documentId,
          );
          if (!document) {
            continue;
          }
          context.proposedDeletes.push({
            targetType: 'document',
            targetId: documentId,
            label: document.title,
            ...(typeof args.reason === 'string' ? { reason: args.reason } : {}),
          });
        }
        return { proposed: true, count: documentIds.length };
      },
    },
  ];
  const starter = context.starterCourse;
  return starter
    ? definitions.filter((tool) =>
        isStarterCourseToolAvailable(tool.name, starter.phase),
      )
    : definitions;
}

export function toolDefinitionsToOpenAiTools(
  tools: AgentToolDefinition[],
): Array<{
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}> {
  return tools.map((tool) => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
}

export async function executeAgentTool(
  tools: AgentToolDefinition[],
  toolName: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const tool = tools.find((entry) => entry.name === toolName);
  if (!tool) {
    throw new Error(`Unknown tool: ${toolName}`);
  }
  return tool.execute(args);
}

export function actionKindFromToolName(
  toolName: string,
): AgentActionKind | undefined {
  const mapping: Record<string, AgentActionKind> = {
    search_knowledge: 'search_knowledge',
    create_directory: 'create_directory',
    create_document: 'create_document',
    generate_quiz: 'generate_quiz',
    create_rule: 'create_rule',
    create_rule_from_blueprint: 'create_rule_from_blueprint',
    update_rule: 'update_rule',
    attach_rule_to_directory: 'attach_rule',
    detach_rule_from_directory: 'detach_rule',
  };
  return mapping[toolName];
}
