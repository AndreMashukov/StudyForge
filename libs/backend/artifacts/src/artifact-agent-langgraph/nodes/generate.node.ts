/**
 * LangGraph node: generate the artifact draft.
 *
 * Mirrors `GenerateAgent` from the ADK `artifact-agent` module:
 *
 * - Reads `artifact_context` (produced by the load-context node) and the
 *   currently-stored `artifact_diagnostics` from state, then delegates to
 *   `definition.generate(context, diagnostics)` to produce a fresh draft.
 * - Increments `diagnostics.generatorAttempts` and ensures a generator
 *   `modelUsage` entry exists. The definition's `recordModelUsage` helper is
 *   the canonical place to push usage entries; we still seed a fallback entry
 *   here so `artifact_generation_model`/`artifact_agent_model` resolve even
 *   if the provider adapter forgot to push one.
 * - Writes `artifact_draft` and the mutated `artifact_diagnostics` back to
 *   state, and records the latest non-empty generator model label as both
 *   `artifact_generation_model` and `artifact_agent_model`. The same
 *   last-write-wins behaviour applies in ADK: both channels are derived from
 *   the same `modelUsage` lookup so they always agree.
 *
 * Diagnostics fallback: when `artifact_diagnostics` is absent (e.g. unit tests
 * that bypass the initial state seed), an empty diagnostics object is built
 * from `createEmptyDiagnostics(definition)` so the generator still has a
 * mutable object to push model-usage entries into. This matches the ADK
 * pipeline where the runner seeds an empty diagnostics object during
 * `createInitialSessionState`.
 *
 * Failure semantics: missing `artifact_definition` or `artifact_context` is
 * treated as a fatal pipeline error. Throwing lets the LangGraph runner
 * surface the failure to the caller the same way the ADK `GenerateAgent`
 * does when it calls `readContext` and finds no context.
 */
import type { IArtifactAgentDiagnostics } from '@shared-types';
import type {
  ArtifactAgentContext,
  ArtifactAgentDefinition,
} from '../../artifact-agent/artifact-agent-definition';
import {
  createEmptyDiagnostics,
  recordModelUsage,
} from '../../artifact-agent/artifact-agent-definition';
import { ARTIFACT_PIPELINE_STATE_KEYS } from '../../artifact-pipeline-state-keys';
import type { DiagramQuizState } from '../diagram-quiz-state';

/**
 * Result type for the generate node. Includes the `artifact_draft`,
 * `artifact_diagnostics`, and (when a generator model label exists)
 * `artifact_generation_model` and `artifact_agent_model` channels. Declaring
 * the return shape explicitly keeps the graph wiring obvious.
 */
export type GenerateNodeResult = Partial<DiagramQuizState>;

/**
 * LangGraph node function: delegates to `definition.generate(context, diagnostics)`.
 *
 * @param state - The current diagram-quiz pipeline state. Reads
 *   `artifact_definition`, `artifact_context`, and `artifact_diagnostics`.
 *   All other channels pass through unchanged.
 * @returns A partial state update that writes `artifact_draft`,
 *   `artifact_diagnostics`, and (when discoverable) the generator model
 *   labels.
 */
export async function generateNode(
  state: DiagramQuizState
): Promise<GenerateNodeResult> {
  const definition = state[
    ARTIFACT_PIPELINE_STATE_KEYS.definition
  ] as ArtifactAgentDefinition<unknown, unknown> | undefined;
  if (!definition) {
    throw new Error('Generate node requires artifact_definition in state');
  }

  const context = state[
    ARTIFACT_PIPELINE_STATE_KEYS.context
  ] as ArtifactAgentContext | undefined;
  if (!context) {
    throw new Error(
      'Generate node requires artifact_context (run loadContext first)'
    );
  }

  const diagnostics: IArtifactAgentDiagnostics =
    (state[
      ARTIFACT_PIPELINE_STATE_KEYS.diagnostics
    ] as IArtifactAgentDiagnostics | undefined) ??
    createEmptyDiagnostics(definition);

  const draft = await definition.generate(context, diagnostics);
  diagnostics.generatorAttempts += 1;

  // Record a fallback generator usage entry so `artifact_generation_model`
  // resolves even when the provider adapter did not push one. The duration
  // and capability are filled in by the adapter in real runs; this entry
  // ensures the model-usage lookup performed below always finds at least
  // one row, matching the ADK `GenerateAgent.runAsyncImpl` semantics.
  recordModelUsage(diagnostics, {
    role: 'generator',
    capability: definition.primaryCapability,
  });

  // Prefer the latest generator usage entry that recorded a non-empty model
  // label. This mirrors `GenerateAgent` in the ADK pipeline.
  const generatorModel = [...diagnostics.modelUsage]
    .reverse()
    .find(
      (entry) =>
        entry.role === 'generator' &&
        typeof entry.model === 'string' &&
        entry.model.trim().length > 0
    )?.model;

  const update: GenerateNodeResult = {
    [ARTIFACT_PIPELINE_STATE_KEYS.draft]: draft,
    [ARTIFACT_PIPELINE_STATE_KEYS.diagnostics]: diagnostics,
  };

  if (generatorModel) {
    update[ARTIFACT_PIPELINE_STATE_KEYS.generationModel] = generatorModel;
    update[ARTIFACT_PIPELINE_STATE_KEYS.agentModel] = generatorModel;
  }

  return update;
}

export default generateNode;