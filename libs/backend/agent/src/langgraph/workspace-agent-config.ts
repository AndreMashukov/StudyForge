import type { RunnableConfig } from '@langchain/core/runnables';
import type { AgentMessageStreamEvent } from '@shared-types';
import type { AgentToolDefinition } from '../tools/create-agent-tools';

export interface IWorkspaceAgentRunnableConfigurable {
  userId: string;
  thread_id: string;
  tools: AgentToolDefinition[];
  onEvent?: (event: AgentMessageStreamEvent) => void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isAgentToolDefinition(value: unknown): value is AgentToolDefinition {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.name === 'string' &&
    value.name.length > 0 &&
    typeof value.execute === 'function'
  );
}

function isAgentMessageStreamHandler(
  value: unknown,
): value is (event: AgentMessageStreamEvent) => void {
  return typeof value === 'function';
}

export function readWorkspaceAgentConfig(
  config: RunnableConfig,
): IWorkspaceAgentRunnableConfigurable {
  const configurable = config.configurable;
  if (!configurable || typeof configurable !== 'object') {
    throw new Error('Workspace agent graph requires configurable context');
  }

  const userId =
    'userId' in configurable && typeof configurable.userId === 'string'
      ? configurable.userId
      : '';
  const threadId =
    'thread_id' in configurable && typeof configurable.thread_id === 'string'
      ? configurable.thread_id
      : '';

  const tools =
    'tools' in configurable && Array.isArray(configurable.tools)
      ? configurable.tools.filter(isAgentToolDefinition)
      : [];

  if (!userId || !threadId) {
    throw new Error(
      'Workspace agent graph requires userId and thread_id in configurable',
    );
  }

  const onEvent =
    'onEvent' in configurable && isAgentMessageStreamHandler(configurable.onEvent)
      ? configurable.onEvent
      : undefined;

  return { userId, thread_id: threadId, tools, onEvent };
}
