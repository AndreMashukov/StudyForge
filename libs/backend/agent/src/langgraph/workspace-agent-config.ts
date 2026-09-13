import type { RunnableConfig } from '@langchain/core/runnables';
import type { AgentMessageStreamEvent } from '@shared-types';
import type { IInProcessMcpSession } from '../mcp';
import { isInProcessMcpSession } from '../mcp';

export interface IWorkspaceAgentRunnableConfigurable {
  userId: string;
  thread_id: string;
  toolSession: IInProcessMcpSession;
  onEvent?: (event: AgentMessageStreamEvent) => void;
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

  const toolSession =
    'toolSession' in configurable &&
    isInProcessMcpSession(configurable.toolSession)
      ? configurable.toolSession
      : null;

  if (!userId || !threadId || !toolSession) {
    throw new Error(
      'Workspace agent graph requires userId, thread_id, and toolSession in configurable',
    );
  }

  const onEvent =
    'onEvent' in configurable && isAgentMessageStreamHandler(configurable.onEvent)
      ? configurable.onEvent
      : undefined;

  return { userId, thread_id: threadId, toolSession, onEvent };
}
