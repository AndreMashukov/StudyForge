/**
 * Channel names for the workspace agent LangGraph pipeline.
 * Nodes must reference these keys, not string literals.
 */
export const WORKSPACE_AGENT_STATE_KEYS = {
  studyForgeThreadId: 'studyForgeThreadId',
  objective: 'objective',
  systemPrompt: 'systemPrompt',
  history: 'history',
  planSteps: 'planSteps',
  pastSteps: 'pastSteps',
  allToolOutcomes: 'allToolOutcomes',
  executedStepCount: 'executedStepCount',
  replanCycle: 'replanCycle',
  plannerIntent: 'plannerIntent',
  finalReply: 'finalReply',
  streamedFinalReply: 'streamedFinalReply',
  agentOutcome: 'agentOutcome',
  failureMessage: 'failureMessage',
} as const;

export type WorkspaceAgentStateKey =
  (typeof WORKSPACE_AGENT_STATE_KEYS)[keyof typeof WORKSPACE_AGENT_STATE_KEYS];

export type WorkspaceAgentPlannerIntent =
  | 'initial'
  | 'replan'
  | 'final'
  | 'complete';

export type WorkspaceAgentOutcome = 'pending' | 'succeeded' | 'failed';
