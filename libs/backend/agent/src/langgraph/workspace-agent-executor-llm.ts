import type { AgentMessageStreamEvent } from '@shared-types';
import type { IInProcessMcpSession } from '../mcp';
import type { AgentToolOutcome } from '../runner/agent-chat-fallback';
import {
  buildStepExecutionMessage,
  composeExecutorStepResult,
  type AgentPlanExecutePastStep,
} from '../runner/agent-plan-execute-helpers';
import { AgentChatRunner } from '../runner/agent-chat-runner';

export interface IRunWorkspaceExecutorStepInput {
  userId: string;
  systemPrompt: string;
  objective: string;
  step: string;
  pastSteps: AgentPlanExecutePastStep[];
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  toolSession: IInProcessMcpSession;
  onEvent?: (event: AgentMessageStreamEvent) => void;
}

export interface IWorkspaceExecutorStepResult {
  text: string;
  toolOutcomes: AgentToolOutcome[];
}

export interface IFormatExecutorPastStepInput {
  step: string;
  text: string;
  toolOutcomes: AgentToolOutcome[];
}

export async function runWorkspaceExecutorStep(
  input: IRunWorkspaceExecutorStepInput,
): Promise<IWorkspaceExecutorStepResult> {
  const stepMessage = buildStepExecutionMessage({
    objective: input.objective,
    step: input.step,
    pastSteps: input.pastSteps,
  });

  const result = await AgentChatRunner.run({
    userId: input.userId,
    systemPrompt: input.systemPrompt,
    userMessage: stepMessage,
    history: input.history,
    toolSession: input.toolSession,
    generationKind: 'agentExecutor',
    maxToolRounds: 4,
    emitDeltas: false,
    onEvent: input.onEvent,
  });

  return {
    text: result.text,
    toolOutcomes: result.toolOutcomes,
  };
}

export function formatExecutorPastStep(
  input: IFormatExecutorPastStepInput,
): AgentPlanExecutePastStep {
  return {
    step: input.step,
    result: composeExecutorStepResult(input.text, input.toolOutcomes),
  };
}
