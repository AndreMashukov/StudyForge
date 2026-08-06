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
import {
  AgentMemoryService,
  AgentThreadStore,
  buildAgentResponse,
} from './memory/agent-memory-service';
import { AgentChatRunner } from './runner/agent-chat-runner';
import {
  AgentToolRuntimeContext,
  createAgentToolDefinitions,
} from './tools/create-agent-tools';

const MAX_DIRECTORY_IDS = 200;

function describePromptContext(promptContext?: AgentPromptContext): string | undefined {
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

  const documentLabel = display || promptContext.documentId;
  const directoryHint = promptContext.directoryId
    ? `, directory id ${promptContext.directoryId}`
    : '';
  return `document "${documentLabel}" (id: ${promptContext.documentId}${directoryHint})`;
}

function formatUserMessageForModel(
  content: string,
  promptContext?: AgentPromptContext
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
    return { role: 'assistant', content: message.content };
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

function collectDescendantIds(nodes: DirectoryTreeNode[], rootId: string): string[] {
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
    return collectDescendantIds(treeResponse.tree, input.directoryId).slice(0, MAX_DIRECTORY_IDS);
  }

  return collectDirectoryIds(treeResponse.tree).slice(0, MAX_DIRECTORY_IDS);
}

function buildSystemPrompt(input: {
  scope: AgentScope;
  directoryId?: string;
  promptContext?: AgentPromptContext;
  memorySnippets: Array<{ content: string; memoryType: string }>;
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
      ? `Current UI context (prompt hint only; tools remain available across the workspace): ${promptContextDescription}.`
      : 'Current UI context: global (no directory or document pinned).',
    'Treat UI context as a hint for pronouns like "this" / "here". Do not refuse broader workspace requests.',
    'Use tools to inspect knowledge, list content, create/update resources, and enqueue generation jobs.',
    'After using tools, always reply with a clear final answer for the user. Never end a turn with only tool calls and no text.',
    'When you create directories or rules, state the full path from tool results (for example /Python/Screenshots).',
    'In workspace scope, omit parentId on create_directory to create at the workspace root; pass parentId to nest under an existing directory.',
    'When the user asks where something is or whether work completed, verify with list_directories / list_rules / list_documents and answer from those results.',
    'Never perform destructive deletes directly. Use propose_delete_* tools and wait for user confirmation.',
    'Directory names cannot contain / \\ : * ? " < > |. Use hyphens instead of slashes (for example, "AI-ML" not "AI/ML").',
    'When creating documents, write HTML body content (h1, p, ul, li). New documents are stored as HTML, not markdown.',
    'For study plans and proposals, answer in chat first unless the user asks you to create directories or documents.',
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
    request: AgentMessageInput
  ): AsyncGenerator<AgentMessageStreamEvent> {
    const directoryIds = await resolveDirectoryIds({
      userId,
      scope: request.scope,
      directoryId: request.directoryId,
    });

    const runtimeContext: AgentToolRuntimeContext = {
      userId,
      scope: request.scope,
      directoryId: request.directoryId,
      directoryIds,
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

    const [memorySnippets, history] = await Promise.all([
      AgentMemoryService.retrieveRelevantMemories(userId, request.message),
      AgentThreadStore.listRecentMessages(userId, thread.id, 12),
    ]);

    await AgentThreadStore.appendMessage({
      userId,
      threadId: thread.id,
      role: 'user',
      content: request.message,
      promptContext: request.promptContext,
    });

    const tools = createAgentToolDefinitions(runtimeContext);
    const systemPrompt = buildSystemPrompt({
      scope: request.scope,
      directoryId: request.directoryId,
      promptContext: request.promptContext,
      memorySnippets,
    });

    const pendingEvents: AgentMessageStreamEvent[] = [];
    let runError: string | null = null;
    let reply = '';
    let runComplete = false;

    const runPromise = AgentChatRunner.run({
      userId,
      systemPrompt,
      userMessage: formatUserMessageForModel(request.message, request.promptContext),
      history: history
        .filter((message) => message.role === 'user' || message.role === 'assistant')
        .map((message) => historyMessageForModel(message)),
      tools,
      onEvent: (event) => {
        if (event.type === 'delta' || event.type === 'status') {
          pendingEvents.push(event);
        }
      },
    })
      .then((result) => {
        reply = result;
      })
      .catch((error: unknown) => {
        runError = error instanceof Error ? error.message : 'Agent execution failed';
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

    for (const action of runtimeContext.executedActions) {
      yield { type: 'action', action };
    }

    for (const proposal of runtimeContext.proposedDeletes) {
      yield { type: 'delete_proposal', proposal };
    }

    await AgentThreadStore.appendMessage({
      userId,
      threadId: thread.id,
      role: 'assistant',
      content: reply,
      executedActions: runtimeContext.executedActions,
      proposedDeletes: runtimeContext.proposedDeletes,
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
