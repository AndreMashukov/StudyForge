import type { RunnableConfig } from '@langchain/core/runnables';
import type { AgentMessageStreamEvent } from '@shared-types';
import type { IAgentToolSession } from '../tools/agent-tool-session';
import { isAgentToolSession } from '../tools/agent-tool-session';
import { isAbortSignal } from '../runner/agent-request-abort';

export interface IWorkspaceAgentRunnableConfigurable {
  userId: string;
  thread_id: string;
  toolSession: IAgentToolSession;
  onEvent?: (event: AgentMessageStreamEvent) => void;
  abortSignal?: AbortSignal;
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
    isAgentToolSession(configurable.toolSession)
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

  const abortSignal =
    'abortSignal' in configurable && isAbortSignal(configurable.abortSignal)
      ? configurable.abortSignal
      : undefined;

  return { userId, thread_id: threadId, toolSession, onEvent, abortSignal };
}
