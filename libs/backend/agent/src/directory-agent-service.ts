import { randomUUID } from 'node:crypto';
import type {
  AgentMessageInput,
  AgentMessageStreamEvent,
  AgentPromptContext,
  AgentScope,
  DirectoryTreeNode,
  IAgentThreadMessage,
} from '@shared-types';
import { directoryService } from '@study-forge/backend-directories/directory';
import { getRule } from '@study-forge/backend-directories/rule-crud';
import { DocumentCrudService } from '@study-forge/backend-documents/document-crud';
import {
  AgentMemoryService,
  AgentThreadStore,
  buildAgentResponse,
  deriveAgentThreadPreview,
  deriveAgentThreadTitle,
} from './memory/agent-memory-service';
import { AgentAdkRunner } from './adk/agent-adk-runner';
import { AgentAdkPlanExecuteRunner } from './adk/agent-adk-plan-execute-runner';
import { LlmGenerationRouteResolver } from '@study-forge/backend-llm/llm';
import { emitAgentTextAsDeltas } from './runner/agent-chat-runner';
import { withExecutedActionContext } from './runner/agent-history';
import {
  buildReplyFromExecutedActions,
  isGenericEmptyAgentReply,
  type AgentToolOutcome,
} from './runner/agent-chat-fallback';
import {
  shouldBlockUngroundedCreateResponse,
  UNGROUNDED_CREATE_FALLBACK,
} from './runner/agent-plan-execute-helpers';
import {
  AGENT_DOCUMENT_CONTENT_MAX_CHARS,
  AgentToolRuntimeContext,
  createAgentToolDefinitions,
  toAgentReadableDocumentContent,
} from './tools/create-agent-tools';
import { resolveAgentCalendarDates } from './tools/quiz-statistics-tools';

const MAX_DIRECTORY_IDS = 200;

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

function historyMessageForModel(message: IAgentThreadMessage): {
  role: 'user' | 'assistant';
  content: string;
} {
  if (message.role === 'assistant') {
    return {
      role: 'assistant',
      content: withExecutedActionContext(
        message.content,
        message.executedActions,
      ),
    };
  }
  return {
    role: 'user',
    content: formatUserMessageForModel(message.content, message.promptContext),
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
    'Never invent document, directory, or rule IDs. Only cite IDs returned by tools.',
    'A written description does not create a document. You must call create_document; if that tool did not run, the document does not exist.',
    'When listing a folder, only include items returned by list_documents. Do not add items from earlier chat claims.',
    'When you create directories or rules, state the full path from tool results (for example /Python/Screenshots).',
    'In workspace scope, omit parentId on create_directory to create at the workspace root; pass parentId to nest under an existing directory.',
    'When the user asks where something is or whether work completed, verify with list_directories / list_rules / list_documents and answer from those results.',
    'When the user asks about quiz performance, scores, accuracy, right vs wrong answers, or knowledge gaps from quizzes, use get_quiz_statistics and get_quiz_answer_details. Those tools cover quizzes, diagram quizzes, and sequence quizzes.',
    `Today is ${input.today}. Yesterday is ${input.yesterday}. These are the user local calendar dates.`,
    'When the user says yesterday or today, pass timeRange yesterday or today on those tools. Re-query every turn. Do not reuse quiz dates or gap lists from earlier messages in this thread.',
    'Never perform destructive deletes directly. Use propose_delete_* tools and wait for user confirmation.',
    'Directory names cannot contain / \\ : * ? " < > |. Use hyphens instead of slashes (for example, "AI-ML" not "AI/ML").',
    'When creating documents, call create_document with a generation prompt. The documentFromPrompt pipeline writes the HTML and applies always-apply rules for that directory. Do not write HTML or markdown yourself.',
    'Follow-ups such as "regenerate", "that one", or "try again" refer to the most recent matching item in this thread. Do not ask the user to restate it.',
    'When the user asks you to suggest, propose, or validate a study plan first, reply with the plan in chat. Do not call create_document or create_directory until they approve.',
    'For other study plans and proposals, answer in chat first unless the user asks you to create directories or documents now.',
    input.currentDocumentBodyBlock,
    input.currentRuleBodyBlock,
    memoryBlock,
  ]
    .filter(Boolean)
    .join('\n');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export class DirectoryAgentService {
  static async *streamMessage(
    userId: string,
    request: AgentMessageInput,
  ): AsyncGenerator<AgentMessageStreamEvent> {
    const directoryIds = await resolveDirectoryIds({
      userId,
      scope: request.scope,
      directoryId: request.directoryId,
    });
    const calendar = resolveAgentCalendarDates(request.clientLocalDate);

    const runtimeContext: AgentToolRuntimeContext = {
      userId,
      scope: request.scope,
      directoryId: request.directoryId,
      directoryIds,
      promptContext: request.promptContext,
      clientLocalDate: calendar.today,
      executedActions: [],
      proposedDeletes: [],
    };

    const thread = await AgentThreadStore.resolveThread({
      userId,
      threadId: request.threadId ?? randomUUID(),
      scope: request.scope,
      directoryId: request.directoryId,
    });

    yield { type: 'thread', threadId: thread.id };

    const [
      memorySnippets,
      history,
      currentDocumentBodyBlock,
      currentRuleBodyBlock,
    ] = await Promise.all([
      AgentMemoryService.retrieveRelevantMemories(userId, request.message),
      AgentThreadStore.listRecentMessages(userId, thread.id, 12),
      loadCurrentDocumentBodyBlock(userId, request.promptContext),
      loadCurrentRuleBodyBlock(userId, request.promptContext),
    ]);

    await AgentThreadStore.appendMessage({
      userId,
      threadId: thread.id,
      role: 'user',
      content: request.message,
      promptContext: request.promptContext,
      ...(history.length === 0
        ? { title: deriveAgentThreadTitle(request.message) }
        : {}),
    });

    const tools = createAgentToolDefinitions(runtimeContext);
    const systemPrompt = buildSystemPrompt({
      scope: request.scope,
      directoryId: request.directoryId,
      promptContext: request.promptContext,
      memorySnippets,
      currentDocumentBodyBlock,
      currentRuleBodyBlock,
      today: calendar.today,
      yesterday: calendar.yesterday,
    });

    const pendingEvents: AgentMessageStreamEvent[] = [];
    let runError: string | null = null;
    let reply = '';
    let runComplete = false;

    const formattedUserMessage = formatUserMessageForModel(
      request.message,
      request.promptContext,
    );
    const historyForModel = history
      .filter(
        (message) => message.role === 'user' || message.role === 'assistant',
      )
      .map((message) => historyMessageForModel(message));

    const runnerInput = {
      userId,
      threadId: thread.id,
      systemPrompt,
      userMessage: formattedUserMessage,
      history: historyForModel,
      tools,
      generationKind:
        request.scope === 'workspace'
          ? ('directoryAgent' as const)
          : ('directoryChat' as const),
      onEvent: (event: AgentMessageStreamEvent) => {
        if (event.type === 'delta' || event.type === 'status') {
          pendingEvents.push(event);
        }
      },
    };

    let runPromise: Promise<string>;
    if (request.scope === 'workspace') {
      const routeResolution = await LlmGenerationRouteResolver.resolve(
        'directoryAgent',
        { userId },
      );
      if (routeResolution.workflow === 'agentic') {
        runPromise = AgentAdkPlanExecuteRunner.run({
          userId,
          threadId: thread.id,
          systemPrompt,
          objective: formattedUserMessage,
          history: historyForModel,
          tools,
          onEvent: runnerInput.onEvent,
        });
      } else {
        runPromise = AgentAdkRunner.run(runnerInput);
      }
    } else {
      runPromise = AgentAdkRunner.run(runnerInput);
    }
    runPromise
      .then((result) => {
        reply = result;
      })
      .catch((error: unknown) => {
        runError =
          error instanceof Error ? error.message : 'Agent execution failed';
      })
      .finally(() => {
        runComplete = true;
      });

    while (!runComplete || pendingEvents.length > 0) {
      while (pendingEvents.length > 0) {
        const event = pendingEvents.shift();
        if (event) {
          yield event;
        }
      }

      if (!runComplete) {
        await sleep(20);
      }
    }

    await runPromise;

    if (runError) {
      yield { type: 'error', message: runError };
      return;
    }

    if (
      isGenericEmptyAgentReply(reply) &&
      runtimeContext.executedActions.length > 0
    ) {
      reply = buildReplyFromExecutedActions(runtimeContext.executedActions);
    }

    const createOutcomes: AgentToolOutcome[] = runtimeContext.executedActions
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
      })
    ) {
      reply = UNGROUNDED_CREATE_FALLBACK;
    }

    await emitAgentTextAsDeltas(reply, (event) => {
      pendingEvents.push(event);
    });
    while (pendingEvents.length > 0) {
      const event = pendingEvents.shift();
      if (event) {
        yield event;
      }
    }

    for (const action of runtimeContext.executedActions) {
      yield { type: 'action', action };
    }

    for (const proposal of runtimeContext.proposedDeletes) {
      yield { type: 'delete_proposal', proposal };
    }

    const preview = deriveAgentThreadPreview(reply);
    await AgentThreadStore.appendMessage({
      userId,
      threadId: thread.id,
      role: 'assistant',
      content: reply,
      executedActions: runtimeContext.executedActions,
      proposedDeletes: runtimeContext.proposedDeletes,
      ...(preview ? { preview } : {}),
    });

    await AgentMemoryService.captureTurnMemories({
      userId,
      threadId: thread.id,
      userMessage: request.message,
      assistantReply: reply,
    });

    yield {
      type: 'done',
      response: buildAgentResponse({
        reply,
        threadId: thread.id,
        executedActions: runtimeContext.executedActions,
        proposedDeletes: runtimeContext.proposedDeletes,
      }),
    };
  }
}
