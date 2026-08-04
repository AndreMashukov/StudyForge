import { randomUUID } from 'node:crypto';
import type {
  AgentMessageInput,
  AgentMessageStreamEvent,
  AgentScope,
  DirectoryTreeNode,
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
  memorySnippets: Array<{ content: string; memoryType: string }>;
}): string {
  const scopeLabel = input.scope === 'workspace' ? 'workspace' : 'directory';
  const memoryBlock =
    input.memorySnippets.length > 0
      ? `\nRelevant memories:\n${input.memorySnippets
          .map((entry) => `- (${entry.memoryType}) ${entry.content}`)
          .join('\n')}`
      : '';

  return [
    'You are StudyForge Directory Agent, a helpful assistant that can inspect and manage StudyForge content.',
    `Active scope: ${scopeLabel}${input.directoryId ? ` (hint directory: ${input.directoryId})` : ''}.`,
    'Use tools to inspect knowledge, list content, create/update resources, and enqueue generation jobs.',
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
    });

    const tools = createAgentToolDefinitions(runtimeContext);
    const systemPrompt = buildSystemPrompt({
      scope: request.scope,
      directoryId: request.directoryId,
      memorySnippets,
    });

    const pendingEvents: AgentMessageStreamEvent[] = [];
    let runError: string | null = null;
    let reply = '';
    let runComplete = false;

    const runPromise = AgentChatRunner.run({
      userId,
      systemPrompt,
      userMessage: request.message,
      history: history
        .filter((message) => message.role === 'user' || message.role === 'assistant')
        .map((message) => ({
          role: message.role,
          content: message.content,
        })),
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
