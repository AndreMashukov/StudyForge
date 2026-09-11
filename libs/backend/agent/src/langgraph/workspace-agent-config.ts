import type { RunnableConfig } from '@langchain/core/runnables';
import type { AgentMessageStreamEvent } from '@shared-types';
import type { AgentToolDefinition } from '../tools/create-agent-tools';

export interface WorkspaceAgentRunnableConfigurable {
  userId: string;
  thread_id: string;
  tools: AgentToolDefinition[];
  onEvent?: (event: AgentMessageStreamEvent) => void;
}

export function readWorkspaceAgentConfig(
  config: RunnableConfig,
): WorkspaceAgentRunnableConfigurable {
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
      ? (configurable.tools as AgentToolDefinition[])
      : [];

  if (!userId || !threadId) {
    throw new Error(
      'Workspace agent graph requires userId and thread_id in configurable',
    );
  }

  const onEvent =
    'onEvent' in configurable &&
    typeof configurable.onEvent === 'function'
      ? (configurable.onEvent as (event: AgentMessageStreamEvent) => void)
      : undefined;

  return { userId, thread_id: threadId, tools, onEvent };
}
