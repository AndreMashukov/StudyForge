/** LangGraph node: critique the refined draft. */
import { ARTIFACT_PIPELINE_STATE_KEYS } from '../../artifact-pipeline-state-keys';
import type { DiagramQuizState } from '../diagram-quiz-state';
import { DiagramQuizStateValue } from '../diagram-quiz-state';
import { logNodeEnter, logNodeExitError, logNodeExitOk } from './node-logger';

const NODE_NAME = 'critic';

export type CriticNodeResult = Partial<DiagramQuizState>;

/**
 * LangGraph node: critique the refined draft.
 *
 * The critic node does NOT write `artifact_generation_model` or
 * `artifact_agent_model`. Those keys are set exclusively by `generate.node.ts`
 * and must remain stable across the verification loop. See the P6 audit fix.
 *
 * P1 audit fix: explicitly increment `critic_iteration_count` on every visit
 * so the conditional edge after `critic` can enforce the maximum verification
 * bound (2 iterations) without relying solely on `recursionLimit`. The
 * counter is always returned as a finite number so the `incrementCounter`
 * reducer on the state channel preserves the new value.
 *
 * Emits `node_enter` and `node_exit` structured log lines with `jobId`. The
 * `iteration` field on the log carries the `critic_iteration_count` value
 * the node is about to write (post-increment) so operators can correlate
 * log lines with the conditional-edge routing decisions.
 */
export async function criticNode(
  state: typeof DiagramQuizStateValue.State
): Promise<CriticNodeResult> {
  const previousCriticCount = state.critic_iteration_count ?? 0;
  const nextCriticCount = previousCriticCount + 1;
  logNodeEnter(NODE_NAME, state, nextCriticCount);
  try {
    const definition = state[ARTIFACT_PIPELINE_STATE_KEYS.definition];
    const draft = state[ARTIFACT_PIPELINE_STATE_KEYS.draft];
    if (!definition) {
      throw new Error('Critic node requires artifact_definition in state');
    }
    if (draft === undefined) {
      throw new Error('Critic node requires artifact_draft in state');
    }

    if (!definition.critic) {
      throw new Error('Critic node requires definition.critic');
    }
    const criticResult = await definition.critic.criticize(
      draft,
      state[ARTIFACT_PIPELINE_STATE_KEYS.context] as Parameters<
        typeof definition.critic.criticize
      >[1],
      state[ARTIFACT_PIPELINE_STATE_KEYS.diagnostics] as Parameters<
        typeof definition.critic.criticize
      >[2]
    );

    const result: CriticNodeResult = {
      [ARTIFACT_PIPELINE_STATE_KEYS.criticResult]: criticResult,
      critic_iteration_count: nextCriticCount,
    };
    logNodeExitOk(NODE_NAME, state, nextCriticCount);
    return result;
  } catch (err) {
    logNodeExitError(NODE_NAME, state, err, nextCriticCount);
    throw err;
  }
}

export default criticNode;
