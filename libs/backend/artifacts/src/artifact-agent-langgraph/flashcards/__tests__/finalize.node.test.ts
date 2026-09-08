/**
 * Node-level tests for `finalize.node.ts` in the flashcards LangGraph
 * pipeline.
 *
 * These tests target the `finalize` node directly (not via the compiled
 * graph). They exercise the behaviors the migration spec calls out as
 * non-negotiable:
 *
 *   - Persist vs. markFailed branching:
 *     - On a clean run (draft present, diagnostics present, no blocker
 *       gate failures, no `outcome === 'failed'`), the node calls
 *       `definition.persistCompleted`.
 *     - On a failed run (any of: `outcome === 'failed'`, draft missing,
 *       diagnostics missing, or blocker gate failures still present), the
 *       node calls `definition.markFailed`.
 *   - The terminal outcome channel is set to `'completed'` or `'failed'`
 *     based on the same branching, so the runner can read the final
 *     outcome off the state without re-deriving it.
 *   - The node does NOT write `artifact_generation_model` or
 *     `artifact_agent_model`. Those keys are written exclusively by
 *     `generate.node.ts` and persist across the run (P6 audit fix).
 *   - The node validates required state channels (`artifact_definition`,
 *     `artifact_context`) and throws on a missing channel because the
 *     finalize node cannot meaningfully proceed without them; the runner
 *     catches and maps the thrown error to the pipeline failure error.
 *
 * `definition.persistCompleted` and `definition.markFailed` are mocked
 * directly on the definition object. No Firestore / LLM mocks are needed
 * because the persist/markFailed callbacks are supplied by the
 * definition (it is the audit boundary, not an SDK).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { IArtifactAgentDiagnostics } from '@shared-types';

import type {
  ArtifactAgentContext,
  ArtifactAgentDefinition,
  ArtifactGateFailure,
} from '../../../artifact-definition';
import type { ArtifactAgentJobInput } from '../../../artifact-job-input';
import { ARTIFACT_PIPELINE_STATE_KEYS } from '../../../artifact-pipeline-state-keys';
import type { FlashcardsState } from '../flashcards-state';
import { finalizeNode } from '../nodes/finalize.node';

function buildDiagnostics(): IArtifactAgentDiagnostics {
  return {
    startedAt: '2026-09-07T08:10:02.000Z',
    finishedAt: '2026-09-07T08:10:03.000Z',
    latencyMs: 1000,
    modelUsage: [],
    warnings: [],
    blocks: [],
  };
}

function buildContext(): ArtifactAgentContext {
  return {
    userId: 'user-1',
    directoryId: 'dir-1',
    recordId: 'rec-1',
    jobId: 'job-1',
    artifactKind: 'flashcards' as ArtifactAgentContext['artifactKind'],
    documentIds: ['doc-1'],
    title: 'Test deck',
    enhancedPrompt: 'Enhanced prompt',
    appliedRuleIds: [],
    followupRuleIds: [],
    sourceContent: { title: 'src', content: 'body', wordCount: 1 },
  };
}

function buildDefinition(
  overrides: Partial<ArtifactAgentDefinition<unknown, unknown>> = {}
): ArtifactAgentDefinition<unknown, unknown> {
  return {
    artifactKind: 'flashcards' as ArtifactAgentDefinition<
      unknown,
      unknown
    >['artifactKind'],
    displayName: 'flashcards',
    collection: 'flashcards',
    primaryCapability: 'flashcards.generate' as ArtifactAgentDefinition<
      unknown,
      unknown
    >['primaryCapability'],
    agentDefinitionVersion: 'test-v1',
    warningsBlockCompletion: false,
    loadContext: vi.fn(async () => buildContext()),
    generate: vi.fn(async () => ({ cards: [] })),
    gates: [],
    persistCompleted: vi.fn(async () => undefined),
    markFailed: vi.fn(async () => undefined),
    limits: {
      maxRepairIterations: 2,
      maxCriticIterations: 0,
      timeoutSeconds: 30,
    },
    ...overrides,
  } as unknown as ArtifactAgentDefinition<unknown, unknown>;
}

function buildJobInput(): ArtifactAgentJobInput {
  return {
    userId: 'user-1',
    directoryId: 'dir-1',
    recordId: 'rec-1',
    jobId: 'job-1',
    artifactKind: 'flashcards',
  };
}

interface IFinalizeStateFixture {
  context?: ArtifactAgentContext | undefined;
  definition?: ArtifactAgentDefinition<unknown, unknown> | undefined;
  draft?: unknown;
  diagnostics?: IArtifactAgentDiagnostics | undefined;
  failures?: ArtifactGateFailure[];
  outcome?: 'completed' | 'failed' | undefined;
  failureMessage?: string | undefined;
  generationModel?: string | undefined;
  agentModel?: string | undefined;
}

function finalizeState(fixture: IFinalizeStateFixture): FlashcardsState {
  return {
    [ARTIFACT_PIPELINE_STATE_KEYS.definition]:
      fixture.definition as FlashcardsState[typeof ARTIFACT_PIPELINE_STATE_KEYS.definition],
    [ARTIFACT_PIPELINE_STATE_KEYS.jobInput]:
      buildJobInput() as FlashcardsState[typeof ARTIFACT_PIPELINE_STATE_KEYS.jobInput],
    [ARTIFACT_PIPELINE_STATE_KEYS.context]:
      fixture.context as FlashcardsState[typeof ARTIFACT_PIPELINE_STATE_KEYS.context],
    [ARTIFACT_PIPELINE_STATE_KEYS.draft]: fixture.draft,
    [ARTIFACT_PIPELINE_STATE_KEYS.diagnostics]:
      fixture.diagnostics as FlashcardsState[typeof ARTIFACT_PIPELINE_STATE_KEYS.diagnostics],
    [ARTIFACT_PIPELINE_STATE_KEYS.gateFailures]: fixture.failures ?? [],
    [ARTIFACT_PIPELINE_STATE_KEYS.outcome]: fixture.outcome,
    [ARTIFACT_PIPELINE_STATE_KEYS.failureMessage]: fixture.failureMessage,
    [ARTIFACT_PIPELINE_STATE_KEYS.generationModel]:
      fixture.generationModel as FlashcardsState[typeof ARTIFACT_PIPELINE_STATE_KEYS.generationModel],
    [ARTIFACT_PIPELINE_STATE_KEYS.agentModel]:
      fixture.agentModel as FlashcardsState[typeof ARTIFACT_PIPELINE_STATE_KEYS.agentModel],
    repair_iteration_count: 0,
  } as unknown as FlashcardsState;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('finalizeNode', () => {
  it('calls persistCompleted and reports "completed" on the happy path', async () => {
    const persistSpy = vi.fn(async () => undefined);
    const markFailedSpy = vi.fn(async () => undefined);
    const definition = buildDefinition({
      persistCompleted: persistSpy,
      markFailed: markFailedSpy,
    });
    const state = finalizeState({
      context: buildContext(),
      definition,
      draft: { cards: [{ q: 'Q', a: 'A' }] },
      diagnostics: buildDiagnostics(),
      failures: [],
      generationModel: 'mock-provider:mock-model',
      agentModel: 'mock-provider:mock-model',
    });

    const result = await finalizeNode(state);

    expect(persistSpy).toHaveBeenCalledTimes(1);
    expect(markFailedSpy).not.toHaveBeenCalled();
    expect(result?.[ARTIFACT_PIPELINE_STATE_KEYS.outcome]).toBe('completed');
  });

  it('forwards generationModel and agentModel to persistCompleted', async () => {
    const persistSpy = vi.fn(async () => undefined);
    const definition = buildDefinition({ persistCompleted: persistSpy });
    const state = finalizeState({
      context: buildContext(),
      definition,
      draft: { cards: [] },
      diagnostics: buildDiagnostics(),
      failures: [],
      generationModel: 'provider-a:model-a',
      agentModel: 'provider-b:model-b',
    });

    await finalizeNode(state);

    expect(persistSpy).toHaveBeenCalledTimes(1);
    const payload = persistSpy.mock.calls[0]?.[0] as {
      generationModel?: string;
      agentModel?: string;
    };
    expect(payload.generationModel).toBe('provider-a:model-a');
    expect(payload.agentModel).toBe('provider-b:model-b');
  });

  it('defaults missing generationModel / agentModel to empty strings', async () => {
    // P6 audit fix: the model channels are written by `generate.node.ts`
    // and must persist across the run. If they are unexpectedly absent
    // here (e.g. a caller bypassed the graph and invoked the node
    // directly), `persistCompleted` is still called - the model fields
    // default to empty strings rather than `undefined` so downstream
    // schema validation does not reject the payload.
    const persistSpy = vi.fn(async () => undefined);
    const definition = buildDefinition({ persistCompleted: persistSpy });
    const state = finalizeState({
      context: buildContext(),
      definition,
      draft: { cards: [] },
      diagnostics: buildDiagnostics(),
      failures: [],
    });

    await finalizeNode(state);

    expect(persistSpy).toHaveBeenCalledTimes(1);
    const payload = persistSpy.mock.calls[0]?.[0] as {
      generationModel?: string;
      agentModel?: string;
    };
    expect(payload.generationModel).toBe('');
    expect(payload.agentModel).toBe('');
  });

  it('calls markFailed and reports "failed" when outcome is "failed"', async () => {
    const persistSpy = vi.fn(async () => undefined);
    const markFailedSpy = vi.fn(async () => undefined);
    const definition = buildDefinition({
      persistCompleted: persistSpy,
      markFailed: markFailedSpy,
    });
    const state = finalizeState({
      context: buildContext(),
      definition,
      draft: { cards: [] },
      diagnostics: buildDiagnostics(),
      failures: [],
      outcome: 'failed',
      failureMessage: 'generate node could not produce a draft',
    });

    const result = await finalizeNode(state);

    expect(markFailedSpy).toHaveBeenCalledTimes(1);
    expect(persistSpy).not.toHaveBeenCalled();
    expect(result?.[ARTIFACT_PIPELINE_STATE_KEYS.outcome]).toBe('failed');
    expect(result?.[ARTIFACT_PIPELINE_STATE_KEYS.failureMessage]).toBe(
      'generate node could not produce a draft'
    );
  });

  it('calls markFailed when the draft is missing', async () => {
    // A draft-less finalize run signals that an upstream node (typically
    // `generate` or `repair`) failed to populate the channel. The node
    // routes to `markFailed` rather than persisting an empty artifact.
    const persistSpy = vi.fn(async () => undefined);
    const markFailedSpy = vi.fn(async () => undefined);
    const definition = buildDefinition({
      persistCompleted: persistSpy,
      markFailed: markFailedSpy,
    });
    const state = finalizeState({
      context: buildContext(),
      definition,
      draft: undefined,
      diagnostics: buildDiagnostics(),
      failures: [],
    });

    const result = await finalizeNode(state);

    expect(markFailedSpy).toHaveBeenCalledTimes(1);
    expect(persistSpy).not.toHaveBeenCalled();
    expect(result?.[ARTIFACT_PIPELINE_STATE_KEYS.outcome]).toBe('failed');
    expect(result?.[ARTIFACT_PIPELINE_STATE_KEYS.failureMessage]).toMatch(
      /draft/i
    );
  });

  it('calls markFailed when diagnostics are missing', async () => {
    const persistSpy = vi.fn(async () => undefined);
    const markFailedSpy = vi.fn(async () => undefined);
    const definition = buildDefinition({
      persistCompleted: persistSpy,
      markFailed: markFailedSpy,
    });
    const state = finalizeState({
      context: buildContext(),
      definition,
      draft: { cards: [] },
      diagnostics: undefined,
      failures: [],
    });

    const result = await finalizeNode(state);

    expect(markFailedSpy).toHaveBeenCalledTimes(1);
    expect(persistSpy).not.toHaveBeenCalled();
    expect(result?.[ARTIFACT_PIPELINE_STATE_KEYS.outcome]).toBe('failed');
  });

  it('calls markFailed when blocker gate failures remain', async () => {
    // Per the migration spec, warnings alone must not keep the loop
    // running, and a finalize visit with blockers still present must
    // mark the run failed rather than persisting a broken artifact.
    const persistSpy = vi.fn(async () => undefined);
    const markFailedSpy = vi.fn(async () => undefined);
    const definition = buildDefinition({
      persistCompleted: persistSpy,
      markFailed: markFailedSpy,
    });
    const state = finalizeState({
      context: buildContext(),
      definition,
      draft: { cards: [] },
      diagnostics: buildDiagnostics(),
      failures: [{ gateId: 'g1', severity: 'blocker', message: 'still bad' }],
    });

    const result = await finalizeNode(state);

    expect(markFailedSpy).toHaveBeenCalledTimes(1);
    expect(persistSpy).not.toHaveBeenCalled();
    expect(result?.[ARTIFACT_PIPELINE_STATE_KEYS.outcome]).toBe('failed');
    expect(result?.[ARTIFACT_PIPELINE_STATE_KEYS.failureMessage]).toMatch(
      /blocker/i
    );
  });

  it('calls persistCompleted when only warning gate failures remain', async () => {
    // Warnings do not block completion. The node must persist the
    // artifact even when warnings are present, because warnings are a
    // non-blocking signal from the gate node.
    const persistSpy = vi.fn(async () => undefined);
    const markFailedSpy = vi.fn(async () => undefined);
    const definition = buildDefinition({
      persistCompleted: persistSpy,
      markFailed: markFailedSpy,
    });
    const state = finalizeState({
      context: buildContext(),
      definition,
      draft: { cards: [] },
      diagnostics: buildDiagnostics(),
      failures: [{ gateId: 'g1', severity: 'warning', message: 'minor' }],
    });

    const result = await finalizeNode(state);

    expect(persistSpy).toHaveBeenCalledTimes(1);
    expect(markFailedSpy).not.toHaveBeenCalled();
    expect(result?.[ARTIFACT_PIPELINE_STATE_KEYS.outcome]).toBe('completed');
  });

  it('clears the failureMessage channel on a successful run', async () => {
    // Finalize is the only node that may set / clear
    // `artifact_failure_message`. A successful run returns `null` for the
    // channel so the runner and downstream persistence can distinguish
    // "no failure recorded" from "failure message still pending".
    const persistSpy = vi.fn(async () => undefined);
    const definition = buildDefinition({ persistCompleted: persistSpy });
    const state = finalizeState({
      context: buildContext(),
      definition,
      draft: { cards: [] },
      diagnostics: buildDiagnostics(),
      failures: [],
      failureMessage: 'leftover message from a previous attempt',
    });

    const result = await finalizeNode(state);

    expect(persistSpy).toHaveBeenCalledTimes(1);
    expect(result?.[ARTIFACT_PIPELINE_STATE_KEYS.failureMessage]).toBeNull();
  });

  it('does not write to the generation_model or agent_model channels (P6)', async () => {
    // P6 audit fix: finalize must not overwrite the model channels.
    // Those keys are written exclusively by `generate.node.ts` and must
    // persist across the run so downstream persistence reads the labels
    // that match the original draft. The finalize node may read them
    // (so it can forward them to `persistCompleted`) but must not write.
    const persistSpy = vi.fn(async () => undefined);
    const definition = buildDefinition({ persistCompleted: persistSpy });
    const state = finalizeState({
      context: buildContext(),
      definition,
      draft: { cards: [] },
      diagnostics: buildDiagnostics(),
      failures: [],
      generationModel: 'mock-provider:mock-model',
      agentModel: 'mock-provider:mock-model',
    });

    const result = await finalizeNode(state);

    expect(
      result?.[ARTIFACT_PIPELINE_STATE_KEYS.generationModel]
    ).toBeUndefined();
    expect(
      result?.[ARTIFACT_PIPELINE_STATE_KEYS.agentModel]
    ).toBeUndefined();
  });

  it('throws when artifact_definition is missing', async () => {
    // The finalize node cannot proceed without a definition (it must
    // dispatch to one of its callbacks). Unlike `generate`/`repair`, the
    // finalize node re-throws because the runner's `GraphRecursionError`
    // / `ArtifactAgentPipelineFailedError` mapping is the documented
    // failure path - there is no `outcome === 'failed'` short-circuit at
    // this point because the run has already entered the terminal node.
    const state = finalizeState({
      context: buildContext(),
      definition: undefined,
      draft: { cards: [] },
      diagnostics: buildDiagnostics(),
      failures: [],
    });

    await expect(finalizeNode(state)).rejects.toThrow(/artifact_definition/);
  });

  it('throws when artifact_context is missing', async () => {
    const state = finalizeState({
      context: undefined,
      definition: buildDefinition(),
      draft: { cards: [] },
      diagnostics: buildDiagnostics(),
      failures: [],
    });

    await expect(finalizeNode(state)).rejects.toThrow(/artifact_context/);
  });

  it('propagates errors from persistCompleted to the caller', async () => {
    // The finalize node does NOT swallow persist errors; the runner is
    // responsible for catching the thrown error and mapping it to
    // `ArtifactAgentPipelineFailedError`. The diagram-quiz finalize
    // node follows the same contract.
    const persistSpy = vi.fn(async () => {
      throw new Error('firestore write failed');
    });
    const definition = buildDefinition({ persistCompleted: persistSpy });
    const state = finalizeState({
      context: buildContext(),
      definition,
      draft: { cards: [] },
      diagnostics: buildDiagnostics(),
      failures: [],
    });

    await expect(finalizeNode(state)).rejects.toThrow(
      'firestore write failed'
    );
  });

  it('propagates errors from markFailed to the caller', async () => {
    const markFailedSpy = vi.fn(async () => {
      throw new Error('mark-failed audit write failed');
    });
    const definition = buildDefinition({ markFailed: markFailedSpy });
    const state = finalizeState({
      context: buildContext(),
      definition,
      draft: { cards: [] },
      diagnostics: buildDiagnostics(),
      failures: [],
      outcome: 'failed',
      failureMessage: 'upstream failure',
    });

    await expect(finalizeNode(state)).rejects.toThrow(
      'mark-failed audit write failed'
    );
  });
});