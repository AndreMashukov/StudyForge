import type {
  AgentActionResult,
  AgentMessageStreamEvent,
  AgentPromptContext,
  AgentProposedDelete,
  AgentQuestion,
  AgentReferencedItem,
  AgentScope,
  DirectoryTreeNode,
  IAgentThreadMessage,
} from '@shared-types';
import { buildAgentPromptRunMessage } from '@shared-types';
import { directoryService } from '@study-forge/backend-directories/directory';
import { getRule } from '@study-forge/backend-directories/rule-crud';
import { DocumentCrudService } from '@study-forge/backend-documents/document-crud';
import {
  AgentMemoryService,
  AgentThreadStore,
} from './memory/agent-memory-service';
import { WorkspaceAgentRunner } from './langgraph/workspace-agent-runner';
import { withExecutedActionContext } from './runner/agent-history';
import {
  buildIncompleteAgentReply,
  buildReplyFromExecutedActions,
  buildStoppedAgentReply,
  FAILED_AGENT_REPLY,
  isGenericEmptyAgentReply,
  type AgentToolOutcome,
} from './runner/agent-chat-fallback';
import {
  AgentRequestAbortedError,
  readAgentTurnAbortReason,
  type AgentTurnAbortReason,
} from './runner/agent-request-abort';
import {
  shouldBlockUngroundedCreateResponse,
  UNGROUNDED_CREATE_FALLBACK,
} from './runner/agent-plan-execute-helpers';
import {
  AGENT_DOCUMENT_CONTENT_MAX_CHARS,
  AgentToolRuntimeContext,
  createAgentToolDefinitions,
  restoreReferencedItemsFromOutcomes,
  seedRuntimeContextFromTurn,
  toAgentReadableDocumentContent,
} from './tools/create-agent-tools';
import { PlatformAgentKnowledgeIndexService } from './knowledge/platform-agent-knowledge-index-service';
import { resolveAgentCalendarDates } from './tools/quiz-statistics-tools';
import {
  resolveStarterCoursePhase,
  type IStarterCourseRuntime,
} from './tools/starter-course-tools';
import { buildStarterCoursePromptBlock } from './runner/starter-course-prompt';
import { getUserOnboarding } from '@study-forge/backend-core/services/user-onboarding-service';
import { STARTER_COURSE_LIMITS } from '@shared-types';

const MAX_DIRECTORY_IDS = 200;

/** The account's starter-course state for a starter turn on this thread. */
async function loadStarterCourseRuntime(
  userId: string,
  threadId: string,
): Promise<IStarterCourseRuntime> {
  const onboarding = await getUserOnboarding(userId);
  const starter = onboarding?.starter;
  return {
    threadId,
    phase: resolveStarterCoursePhase({
      turnsUsed: starter?.turnsUsed ?? 1,
      documentsUsed: starter?.documentsUsed ?? 0,
      directoryId: starter?.directoryId,
    }),
    ...(onboarding?.sampleDirectoryId
      ? { sampleDirectoryId: onboarding.sampleDirectoryId }
      : {}),
    ...(starter?.directoryId ? { directoryId: starter.directoryId } : {}),
    documentsRemaining: Math.max(
      0,
      STARTER_COURSE_LIMITS.maxDocuments - (starter?.documentsUsed ?? 0),
    ),
    ...(starter?.failedAt ? { isRetry: true } : {}),
  };
}

function describePromptContext(
  promptContext?: AgentPromptContext,
): string | undefined {
  if (!promptContext) {
    return undefined;
  }

  const label = promptContext.label?.trim();
  const path = promptContext.path?.trim();
  const display = path || label;

  if (promptContext.type === 'directory') {
    return display
      ? `directory "${display}" (id: ${promptContext.directoryId})`
      : `directory id ${promptContext.directoryId}`;
  }

  if (promptContext.type === 'document') {
    const documentLabel = display || promptContext.documentId;
    const directoryHint = promptContext.directoryId
      ? `, directory id ${promptContext.directoryId}`
      : '';
    return `document "${documentLabel}" (id: ${promptContext.documentId}${directoryHint})`;
  }

  const ruleLabel = display || promptContext.ruleId;
  return `rule "${ruleLabel}" (id: ${promptContext.ruleId})`;
}

function formatUserMessageForModel(
  content: string,
  promptContext?: AgentPromptContext,
): string {
  const description = describePromptContext(promptContext);
  if (!description) {
    return content;
  }
  return `[UI context: user was viewing ${description}]\n${content}`;
}

/** Lets the planner see what it asked, so the next user message reads as answers. */
function withAskedQuestionsContext(
  content: string,
  questions: AgentQuestion[] | undefined,
): string {
  if (!questions || questions.length === 0) {
    return content;
  }
  const asked = questions
    .map(
      (question) =>
        `- ${question.question} Options: ${question.options
          .map((option) =>
            option.recommended ? `${option.label} (recommended)` : option.label,
          )
          .join(', ')}`,
    )
    .join('\n');
  return `${content}\n\n[Asked the user:\n${asked}]`;
}

function historyMessageForModel(message: IAgentThreadMessage): {
  role: 'user' | 'assistant';
  content: string;
} {
  if (message.role === 'assistant') {
    return {
      role: 'assistant',
      content: withAskedQuestionsContext(
        withExecutedActionContext(message.content, message.executedActions),
        message.questions,
      ),
    };
  }
  // A run of a saved agent prompt keeps its request in the history (ADR 017).
  const content = message.agentPrompt
    ? buildAgentPromptRunMessage({
        name: message.agentPrompt.name,
        content: message.agentPrompt.content,
        extra: message.content,
      })
    : message.content;
  return {
    role: 'user',
    content: formatUserMessageForModel(content, message.promptContext),
  };
}

function collectDirectoryIds(nodes: DirectoryTreeNode[]): string[] {
  const ids: string[] = [];
  const walk = (entries: DirectoryTreeNode[]): void => {
    for (const node of entries) {
      ids.push(node.directory.id);
      if (node.children.length > 0) {
        walk(node.children);
      }
    }
  };
  walk(nodes);
  return ids;
}

function collectDescendantIds(
  nodes: DirectoryTreeNode[],
  rootId: string,
): string[] {
  const ids: string[] = [];

  const walk = (node: DirectoryTreeNode): void => {
    ids.push(node.directory.id);
    for (const child of node.children) {
      walk(child);
    }
  };

  const findNode = (entries: DirectoryTreeNode[]): DirectoryTreeNode | null => {
    for (const node of entries) {
      if (node.directory.id === rootId) {
        return node;
      }
      const nested = findNode(node.children);
      if (nested) {
        return nested;
      }
    }
    return null;
  };

  const rootNode = findNode(nodes);
  if (!rootNode) {
    return [rootId];
  }

  walk(rootNode);
  return ids;
}

async function resolveDirectoryIds(input: {
  userId: string;
  scope: AgentScope;
  directoryId?: string;
}): Promise<string[]> {
  const treeResponse = await directoryService.getDirectoryTree(input.userId);

  if (input.scope === 'directory') {
    if (!input.directoryId) {
      throw new Error('directoryId is required for directory scope');
    }
    return collectDescendantIds(treeResponse.tree, input.directoryId).slice(
      0,
      MAX_DIRECTORY_IDS,
    );
  }

  return collectDirectoryIds(treeResponse.tree).slice(0, MAX_DIRECTORY_IDS);
}

async function loadCurrentDocumentBodyBlock(
  userId: string,
  promptContext?: AgentPromptContext,
): Promise<string | undefined> {
  if (!promptContext || promptContext.type !== 'document') {
    return undefined;
  }

  try {
    const document = await DocumentCrudService.getDocumentWithContent(
      userId,
      promptContext.documentId,
    );
    const readable = toAgentReadableDocumentContent(
      document.content,
      document.contentFormat,
    );
    const body =
      readable.length > AGENT_DOCUMENT_CONTENT_MAX_CHARS
        ? `${readable.slice(0, AGENT_DOCUMENT_CONTENT_MAX_CHARS)}\n\n[truncated: use get_document_content for more]`
        : readable;

    return [
      `Current document body is preloaded below (id: ${document.id}, title: "${document.title}").`,
      'Ground any extraction, explanation, or rewrite in this body. Do not invent alternate examples.',
      '--- BEGIN CURRENT DOCUMENT ---',
      body,
      '--- END CURRENT DOCUMENT ---',
    ].join('\n');
  } catch {
    return [
      `Current UI document id ${promptContext.documentId} could not be preloaded.`,
      'Call get_document_content with that documentId before answering about its contents.',
    ].join(' ');
  }
}

async function loadCurrentRuleBodyBlock(
  userId: string,
  promptContext?: AgentPromptContext,
): Promise<string | undefined> {
  if (!promptContext || promptContext.type !== 'rule') {
    return undefined;
  }

  try {
    const rule = await getRule(userId, promptContext.ruleId);
    if (!rule) {
      return `Current UI rule id ${promptContext.ruleId} could not be found.`;
    }

    return [
      `Current rule is preloaded below (id: ${rule.id}, name: "${rule.name}").`,
      'Ground rule summaries, edits, or application questions in this body.',
      '--- BEGIN CURRENT RULE ---',
      rule.content,
      '--- END CURRENT RULE ---',
    ].join('\n');
  } catch {
    return [
      `Current UI rule id ${promptContext.ruleId} could not be preloaded.`,
      'Use list_rules to inspect available rules before answering about this rule.',
    ].join(' ');
  }
}

function buildSystemPrompt(input: {
  scope: AgentScope;
  directoryId?: string;
  promptContext?: AgentPromptContext;
  memorySnippets: Array<{ content: string; memoryType: string }>;
  currentDocumentBodyBlock?: string;
  currentRuleBodyBlock?: string;
  platformKnowledgeBlock?: string;
  starterCourseBlock?: string;
  today: string;
  yesterday: string;
}): string {
  const scopeLabel = input.scope === 'workspace' ? 'workspace' : 'directory';
  const promptContextDescription = describePromptContext(input.promptContext);
  const memoryBlock =
    input.memorySnippets.length > 0
      ? `\nRelevant memories:\n${input.memorySnippets
          .map((entry) => `- (${entry.memoryType}) ${entry.content}`)
          .join('\n')}`
      : '';

  return [
    'You are StudyForge Directory Agent, a helpful assistant that can inspect and manage StudyForge content.',
    `Active scope: ${scopeLabel}${input.directoryId ? ` (hint directory: ${input.directoryId})` : ''}.`,
    promptContextDescription
      ? `Current UI context (prompt hint; tools remain available across the workspace): ${promptContextDescription}.`
      : 'Current UI context: global (no directory or document pinned).',
    'Treat UI context as a hint for pronouns like "this" / "here". Do not refuse broader workspace requests.',
    'When the user asks about content from a document or folder (summarize, explain expressions, extract examples, rewrite), you MUST read the source with tools first:',
    '- Document UI context: use the preloaded current document body when present, otherwise call get_document_content.',
    '- Directory UI context: call list_documents with that directoryId, then get_document_content on the relevant document(s).',
    '- Rule UI context: use the preloaded current rule body when present.',
    '- Never invent code samples, expressions, or quotes that are not present in the retrieved source content.',
    'Use tools to inspect knowledge, list content, create/update resources, and enqueue generation jobs.',
    'After using tools, always reply with a clear final answer for the user. Never end a turn with only tool calls and no text.',
    'Naming: the app shows rules to users as "prompts". In replies, call them prompts (for example "I created the prompt Biology format" or "attached 2 prompts"). When the user says "prompt" about saved instructions, they mean a rule. Tool names, tool arguments and IDs keep "rule".',
    'Never invent document, directory, or rule IDs. Only cite IDs returned by tools.',
    'A written description does not create a document. You must call create_document; if that tool did not run, the document does not exist.',
    'A document whose generationStatus is "failed" has no content: its generation did not finish. Do not read it, summarize it, or report it as done. When the user asks for that document again or to retry, call create_document again with the full prompt (the failed placeholder can stay). A "pending" document is still generating: say so instead of reading it.',
    'When listing a folder, only include items returned by list_documents. Do not add items from earlier chat claims.',
    'When you create directories or rules, state the full path from tool results (for example /Python/Screenshots).',
    'create_directory without parentId creates inside the folder the user is viewing (UI context), or at the workspace root when nothing is open. Pass parentId "root" only when the user asks for a top-level folder; pass a directory id to nest somewhere else.',
    'When the user asks where something is or whether work completed, verify with list_directories / list_rules / list_documents and answer from those results.',
    'When the user asks about quiz performance, scores, accuracy, right vs wrong answers, or knowledge gaps from quizzes, use get_quiz_statistics and get_quiz_answer_details. Those tools cover quizzes, diagram quizzes, and sequence quizzes.',
    `Today is ${input.today}. Yesterday is ${input.yesterday}. These are the user local calendar dates.`,
    'When the user says yesterday or today, pass timeRange yesterday or today on those tools. Re-query every turn. Do not reuse quiz dates or gap lists from earlier messages in this thread.',
    'Never perform destructive deletes directly. Use propose_delete_* tools and wait for user confirmation.',
    'Directory names cannot contain / \\ : * ? " < > |. Use hyphens instead of slashes (for example, "AI-ML" not "AI/ML").',
    'When creating documents, call create_document with source text only in the prompt (the material to transform or the topic). Do not paste rule bodies. The documentFromPrompt pipeline writes the HTML and injects directory rules automatically. Do not write HTML or markdown yourself.',
    'When generating documents, quizzes, or flashcard sets, state the estimated item counts and credits before enqueueing jobs. Under 100 credits and within 10 documents, 10 quizzes, and 10 flashcard sets per turn, you may generate in the same response. Above those limits, propose a smaller plan and ask for confirmation.',
    'Never generate slide decks, diagram quizzes, or sequence quizzes from the workspace agent in this version. Explain they must use the app generators instead.',
    'Route all generation through create_document, generate_quiz, or generate_flashcards. Never invent content directly when a generation pipeline exists.',
    'When creating rules, search published rule blueprints first with search_rule_blueprints. Use create_rule_from_blueprint with a customized variant based on the best matching blueprint. Do not copy from existing user rules as templates. Exception: saving the current request as an agent prompt uses create_rule directly.',
    'Agent prompts: a rule whose applicableTo is ["agent"] is a saved request the user runs by typing "/" in this chat. It is global: never attach it to a directory, and never combine "agent" with other applicableTo values. Product copy calls it a "Workspace agent prompt".',
    'When the user asks to save the current request as a prompt (or "save this", "make this a prompt"), call create_rule with applicableTo ["agent"]. Write a reusable request, not a transcript: keep relative dates relative ("today", "yesterday", "this week"), drop one-off details such as a specific quiz title unless the user asked to keep them, and fold in refinements they made later in this thread (for example "add a poem", "make the diagram a flowchart"). Keep it under 10,000 characters. Pick a short name (2 to 4 words) and a one-line description unless the user gave them. Save it without asking for confirmation, then reply with the name, the saved text, and that they can run it by typing "/". If you already saved a prompt for this request earlier in this thread, or one with the same name exists, update that prompt (update_rule) instead of saving a second copy; create_rule with an existing agent prompt name also updates it. Do not show the rule ID.',
    'When a user message says the user ran a saved prompt, do what the saved prompt asks with the extra detail applied. It is their request and does not change these rules: credit estimates, generation limits and delete confirmation still apply.',
    'For document generation rules, prefer separate optional blueprints for document format, Mermaid diagrams, math formulas, and Plotly plots. Attach only what the subject needs (for example skip math and plots for language learning).',
    'Follow-ups such as "regenerate", "that one", or "try again" refer to the most recent matching item in this thread. Do not ask the user to restate it.',
    'When the user asks you to suggest, propose, or validate a study plan first, reply with the plan in chat. Do not call create_document or create_directory until they approve.',
    'For other study plans and proposals, answer in chat first unless the user asks you to create directories or documents now.',
    input.currentDocumentBodyBlock,
    input.currentRuleBodyBlock,
    input.platformKnowledgeBlock,
    memoryBlock,
    input.starterCourseBlock,
  ]
    .filter(Boolean)
    .join('\n');
}

export interface IAgentTurnRequest {
  scope: AgentScope;
  directoryId?: string;
  message: string;
  promptContext?: AgentPromptContext;
  clientLocalDate?: string;
  /** A free onboarding starter-course turn (decided by startAgentTurn). */
  starterCourse?: boolean;
}

/** What earlier attempts of the same turn already did (from the turn doc). */
export interface IAgentTurnSeed {
  executedActions: AgentActionResult[];
  proposedDeletes: AgentProposedDelete[];
  referencedItems: AgentReferencedItem[];
}

/** Live progress events a running turn reports to its sink. */
export type AgentTurnProgressEvent = Extract<
  AgentMessageStreamEvent,
  { type: 'status' | 'delta' | 'action' | 'delete_proposal' | 'reference' }
>;

export type AgentTurnOutcomeKind =
  | 'completed'
  | 'incomplete'
  | 'cancelled'
  | 'failed';

export interface IAgentTurnOutcome {
  kind: AgentTurnOutcomeKind;
  /** Final reply text to store on the assistant message. */
  reply: string;
  executedActions: AgentActionResult[];
  proposedDeletes: AgentProposedDelete[];
  referencedItems: AgentReferencedItem[];
  /** Clarifying questions a completed turn asks the user. */
  questions?: AgentQuestion[];
  /** Set when the turn stopped early (deadline or error). */
  errorMessage?: string;
  errorCode?: 'deadline' | 'internal';
  /** The underlying error for `failed`, so the caller can decide on a retry. */
  cause?: unknown;
  retrievedTexts?: string[];
}

export interface IExecuteAgentTurnInput {
  userId: string;
  threadId: string;
  turnId: string;
  request: IAgentTurnRequest;
  /** Continue from the LangGraph checkpoint of an earlier attempt. */
  resume: boolean;
  seed?: IAgentTurnSeed;
  attempt?: number;
}

export interface IExecuteAgentTurnOptions {
  onEvent: (event: AgentTurnProgressEvent) => void;
  /** Abort with an AgentTurnAbortReason: 'cancel', 'deadline' or 'superseded'. */
  signal?: AbortSignal;
}

/** How long to wait for the graph to unwind after an abort before giving up on it. */
export const AGENT_TURN_ABORT_GRACE_MS = 15_000;

const HISTORY_MESSAGE_LIMIT = 12;

function isAgentTurnProgressEvent(
  event: AgentMessageStreamEvent,
): event is AgentTurnProgressEvent {
  return (
    event.type === 'status' ||
    event.type === 'delta' ||
    event.type === 'action' ||
    event.type === 'delete_proposal' ||
    event.type === 'reference'
  );
}

/**
 * Waits for the run to settle. After an abort it waits at most
 * AGENT_TURN_ABORT_GRACE_MS, so a graph stuck in a tool cannot hold the turn.
 */
async function waitForRunToSettle(
  runPromise: Promise<void>,
  signal?: AbortSignal,
): Promise<void> {
  if (!signal) {
    await runPromise;
    return;
  }

  await new Promise<void>((resolve) => {
    let graceTimer: ReturnType<typeof setTimeout> | undefined;
    const finish = (): void => {
      if (graceTimer) {
        clearTimeout(graceTimer);
      }
      signal.removeEventListener('abort', onAbort);
      resolve();
    };
    const onAbort = (): void => {
      graceTimer = setTimeout(finish, AGENT_TURN_ABORT_GRACE_MS);
    };

    if (signal.aborted) {
      onAbort();
    } else {
      signal.addEventListener('abort', onAbort, { once: true });
    }
    void runPromise.then(finish, finish);
  });
}

/**
 * Rejects as soon as the turn is stopped or hits its deadline, so slow
 * preparation (directory tree, memory embeddings, knowledge search) cannot
 * hold the turn. The underlying work is not cancelled, only no longer awaited.
 */
function untilAborted<T>(
  promise: Promise<T>,
  signal?: AbortSignal,
): Promise<T> {
  if (!signal) {
    return promise;
  }
  if (signal.aborted) {
    return Promise.reject(new AgentRequestAbortedError());
  }
  return new Promise<T>((resolve, reject) => {
    const onAbort = (): void => reject(new AgentRequestAbortedError());
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener('abort', onAbort);
        reject(error);
      },
    );
  });
}

function buildAbortedOutcomeReply(input: {
  reason: AgentTurnAbortReason;
  streamedReply: string;
  executedActions: AgentActionResult[];
}): Pick<IAgentTurnOutcome, 'kind' | 'reply' | 'errorMessage' | 'errorCode'> {
  const partial = input.streamedReply.trim();
  if (input.reason === 'cancel') {
    return {
      kind: 'cancelled',
      reply:
        partial.length > 0
          ? partial
          : buildStoppedAgentReply(input.executedActions),
    };
  }
  if (input.reason === 'deadline') {
    return {
      kind: 'incomplete',
      reply:
        partial.length > 0
          ? partial
          : buildIncompleteAgentReply(input.executedActions),
      errorMessage: 'The agent turn hit its time limit',
      errorCode: 'deadline',
    };
  }
  // Superseded: another attempt owns the turn; this outcome is never stored.
  return {
    kind: 'failed',
    reply: partial,
    errorMessage: 'Agent turn was superseded by a newer attempt',
    errorCode: 'internal',
  };
}

/**
 * Runs one agent turn: builds the prompt context, runs the plan-execute graph
 * and returns the outcome. It reports progress through `onEvent` and persists
 * nothing; the caller (the turn worker) owns the turn doc and the thread.
 */
export async function executeAgentTurn(
  input: IExecuteAgentTurnInput,
  options: IExecuteAgentTurnOptions,
): Promise<IAgentTurnOutcome> {
  const { userId, threadId, turnId, request } = input;
  const signal = options.signal;
  let streamedReply = '';

  const emit = (event: AgentMessageStreamEvent): void => {
    if (!isAgentTurnProgressEvent(event)) {
      return;
    }
    if (event.type === 'delta') {
      streamedReply += event.text;
    }
    options.onEvent(event);
  };

  const abortedBeforeGraph = (): IAgentTurnOutcome => ({
    ...buildAbortedOutcomeReply({
      reason: readAgentTurnAbortReason(signal) ?? 'cancel',
      streamedReply,
      executedActions: input.seed?.executedActions ?? [],
    }),
    executedActions: [...(input.seed?.executedActions ?? [])],
    proposedDeletes: [...(input.seed?.proposedDeletes ?? [])],
    referencedItems: [...(input.seed?.referencedItems ?? [])],
  });

  let directoryIds: string[];
  try {
    directoryIds = await untilAborted(
      resolveDirectoryIds({
        userId,
        scope: request.scope,
        directoryId: request.directoryId,
      }),
      signal,
    );
  } catch (error) {
    if (error instanceof AgentRequestAbortedError) {
      return abortedBeforeGraph();
    }
    throw error;
  }
  const calendar = resolveAgentCalendarDates(request.clientLocalDate);
  const starterCourse = request.starterCourse
    ? await loadStarterCourseRuntime(userId, threadId)
    : undefined;

  const runtimeContext: AgentToolRuntimeContext = {
    userId,
    scope: request.scope,
    directoryId: request.directoryId,
    directoryIds,
    promptContext: request.promptContext,
    clientLocalDate: calendar.today,
    executedActions: [],
    proposedDeletes: [],
    referencedItems: [],
    seenItems: new Map(),
    generationBatchCounts: {
      documents: 0,
      quizzes: 0,
      flashcardSets: 0,
    },
    abortSignal: signal,
    onEvent: emit,
    ...(starterCourse ? { starterCourse } : {}),
  };
  if (input.seed) {
    seedRuntimeContextFromTurn(runtimeContext, input.seed);
  }

  const preparation = Promise.all([
    AgentMemoryService.retrieveRelevantMemories(userId, request.message),
    // One extra so the current turn's own user message can be dropped.
    AgentThreadStore.listRecentMessages(
      userId,
      threadId,
      HISTORY_MESSAGE_LIMIT + 1,
    ),
    loadCurrentDocumentBodyBlock(userId, request.promptContext),
    loadCurrentRuleBodyBlock(userId, request.promptContext),
    PlatformAgentKnowledgeIndexService.searchPlatformKnowledge({
      userId,
      query: request.message,
    }),
  ]);
  let prepared: Awaited<typeof preparation>;
  try {
    prepared = await untilAborted(preparation, signal);
  } catch (error) {
    if (error instanceof AgentRequestAbortedError) {
      return abortedBeforeGraph();
    }
    throw error;
  }
  const [
    memorySnippets,
    recentMessages,
    currentDocumentBodyBlock,
    currentRuleBodyBlock,
    platformKnowledgeMatches,
  ] = prepared;

  const tools = createAgentToolDefinitions(runtimeContext);
  const platformKnowledgeBlock =
    platformKnowledgeMatches.length > 0
      ? [
          'Platform knowledge (follow these operational policies when planning generation):',
          ...platformKnowledgeMatches.map(
            (entry) => `- [${entry.docTitle}] ${entry.text}`,
          ),
        ].join('\n')
      : undefined;
  const systemPrompt = buildSystemPrompt({
    scope: request.scope,
    directoryId: request.directoryId,
    promptContext: request.promptContext,
    memorySnippets,
    currentDocumentBodyBlock,
    currentRuleBodyBlock,
    platformKnowledgeBlock,
    starterCourseBlock: starterCourse
      ? buildStarterCoursePromptBlock({
          phase: starterCourse.phase,
          sampleDirectoryId: starterCourse.sampleDirectoryId,
          courseDirectoryId: starterCourse.directoryId,
          documentsRemaining: starterCourse.documentsRemaining,
          isRetry: starterCourse.isRetry,
        })
      : undefined,
    today: calendar.today,
    yesterday: calendar.yesterday,
  });

  const formattedUserMessage = formatUserMessageForModel(
    request.message,
    request.promptContext,
  );
  const historyForModel = recentMessages
    .filter(
      (message) =>
        message.turnId !== turnId &&
        message.turnStatus !== 'failed' &&
        (message.role === 'user' || message.role === 'assistant'),
    )
    .slice(-HISTORY_MESSAGE_LIMIT)
    .map((message) => historyMessageForModel(message));

  const retrievedTexts =
    process.env['LANGSMITH_EVAL_EMIT_RETRIEVED_TEXTS'] === 'true'
      ? platformKnowledgeMatches.map((entry) => entry.text)
      : undefined;

  if (signal?.aborted) {
    return abortedBeforeGraph();
  }

  let reply = '';
  let questions: AgentQuestion[] = [];
  let runError: unknown = null;
  let runSettled = false;

  const runPromise = WorkspaceAgentRunner.run({
    userId,
    studyForgeThreadId: threadId,
    turnId,
    resume: input.resume,
    attempt: input.attempt,
    onResumeToolOutcomes: (outcomes) =>
      restoreReferencedItemsFromOutcomes(runtimeContext, outcomes),
    systemPrompt,
    objective: formattedUserMessage,
    history: historyForModel,
    tools,
    signal,
    onEvent: emit,
    onQuestions: (asked) => {
      questions = asked;
    },
  }).then(
    (result) => {
      reply = result;
      runSettled = true;
    },
    (error: unknown) => {
      runError = error;
      runSettled = true;
    },
  );

  await waitForRunToSettle(runPromise, signal);

  const lists = {
    executedActions: [...runtimeContext.executedActions],
    proposedDeletes: [...runtimeContext.proposedDeletes],
    referencedItems: [...runtimeContext.referencedItems],
  };
  const withRetrieved = retrievedTexts ? { retrievedTexts } : {};

  const abortReason = readAgentTurnAbortReason(signal);
  const finishedCleanly = runSettled && runError === null;
  if (abortReason && !finishedCleanly) {
    return {
      ...buildAbortedOutcomeReply({
        reason: abortReason,
        streamedReply,
        executedActions: lists.executedActions,
      }),
      ...lists,
      ...withRetrieved,
    };
  }

  if (runError !== null) {
    const errorMessage =
      runError instanceof Error ? runError.message : 'Agent execution failed';
    if (lists.executedActions.length > 0) {
      return {
        kind: 'incomplete',
        reply: buildIncompleteAgentReply(lists.executedActions),
        errorMessage,
        errorCode: 'internal',
        cause: runError,
        ...lists,
        ...withRetrieved,
      };
    }
    return {
      kind: 'failed',
      reply: FAILED_AGENT_REPLY,
      errorMessage,
      errorCode: 'internal',
      cause: runError,
      ...lists,
      ...withRetrieved,
    };
  }

  if (isGenericEmptyAgentReply(reply) && lists.executedActions.length > 0) {
    reply = buildReplyFromExecutedActions(lists.executedActions);
  }

  const createOutcomes: AgentToolOutcome[] = lists.executedActions
    .filter((action) => action.kind === 'create_document')
    .map((action) => ({
      name: 'create_document',
      ok: true,
      result: {
        id: action.entityId,
        documentId: action.entityId,
      },
    }));
  if (
    shouldBlockUngroundedCreateResponse({
      objective: formattedUserMessage,
      outcomes: createOutcomes,
      questionCount: questions.length,
    })
  ) {
    reply = UNGROUNDED_CREATE_FALLBACK;
  }

  return {
    kind: 'completed',
    reply,
    ...lists,
    ...(questions.length > 0 ? { questions } : {}),
    ...withRetrieved,
  };
}
