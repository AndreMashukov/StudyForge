import type { AgentMessageStreamEvent } from '@shared-types';
import type { AgentToolDefinition } from '../tools/create-agent-tools';
import type { AgentToolOutcome } from '../runner/agent-chat-fallback';
import {
  buildStepExecutionMessage,
  composeExecutorStepResult,
  type AgentPlanExecutePastStep,
} from '../runner/agent-plan-execute-helpers';
import { AgentChatRunner } from '../runner/agent-chat-runner';

export async function runWorkspaceExecutorStep(input: {
  userId: string;
  systemPrompt: string;
  objective: string;
  step: string;
  pastSteps: AgentPlanExecutePastStep[];
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  tools: AgentToolDefinition[];
  onEvent?: (event: AgentMessageStreamEvent) => void;
}): Promise<{ text: string; toolOutcomes: AgentToolOutcome[] }> {
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
    tools: input.tools,
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

export function formatExecutorPastStep(input: {
  step: string;
  text: string;
  toolOutcomes: AgentToolOutcome[];
}): AgentPlanExecutePastStep {
  return {
    step: input.step,
    result: composeExecutorStepResult(input.text, input.toolOutcomes),
  };
}
