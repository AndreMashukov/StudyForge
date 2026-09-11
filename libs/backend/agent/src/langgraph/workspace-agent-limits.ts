import { MAX_PLAN_STEPS } from '../runner/agent-plan-execute-helpers';

export const MAX_REPLAN_CYCLES = 8;

export { MAX_PLAN_STEPS };

/**
 * Recursion limit for the workspace agent graph (node visits, not inner LLM calls).
 * Formula: 1 initial planner + (MAX_PLAN_STEPS executor + MAX_REPLAN_CYCLES replan planner)
 *          + 1 final planner + 2 safety margin
 */
export const WORKSPACE_AGENT_RECURSION_LIMIT =
  1 + MAX_PLAN_STEPS + MAX_REPLAN_CYCLES + 1 + 2;

export const FORCED_CREATE_DOCUMENT_STEP =
  'Call create_document with a generation prompt now. A written summary does not create the document. Do not invent an id.';
