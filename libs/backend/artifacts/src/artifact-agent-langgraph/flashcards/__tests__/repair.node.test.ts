/**
 * Node-level tests for `repair.node.ts` in the flashcards LangGraph
 * pipeline.
 *
 * These tests target the `repair` node directly (not via the compiled
 * graph). They exercise the behaviors the migration spec calls out as
 * non-negotiable:
 *
 *   - P1 audit fix: the repair node explicitly bumps
 *     `repair_iteration_count` on every visit. The conditional edge
 *     `routeAfterGate` reads this counter to enforce the
 *     `FLASHCARDS_MAX_REPAIR_ITERATIONS` bound; without the explicit
 *     bump, the loop would never advance and the bound check would never
 *     trigger.
 *   - P6: the repair node does NOT write `artifact_generation_model` or
 *     `artifact_agent_model`. Those keys are written exclusively by
 *     `generate.node.ts` and must remain stable across the repair loop.
 *   - P4: when the repair callback throws, the node must NOT re-throw.
 *     It must return a partial state update that sets
 *     `artifact_outcome = 'failed'`, carries the error message, and
 *     still advances the repair counter so the route function sees the
 *     loop has been visited.
 *   - The node validates required state channels
 *     (`artifact_definition`, `artifact_draft`) and converts a missing
 *     channel into a `failed` outcome rather than a thrown exception.
 *
 * `definition.repair.repair` is mocked directly on the definition object;
 * no Firestore / LLM mocks are needed because the repair callback is
 * supplied by the definition (it is the audit boundary, not an SDK).
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
import { repairNode } from '../nodes/repair.node';

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

function buildRepairStrategy(
  repairSpy: ReturnType<typeof vi.fn>
): NonNullable<ArtifactAgentDefinition<unknown, unknown>['repair']> {
  return {
    repair: repairSpy as unknown as NonNullable<
      ArtifactAgentDefinition<unknown, unknown>['repair']
    >['repair'],
  };
}

function buildDefinition(
  overrides: Partial<ArtifactAgentDefinition<unknown, unknown>> = {}
): ArtifactAgentDefinition<unknown, unknown> {
  const repairSpy = vi.fn(
    async (draft: unknown): Promise<unknown> => draft
  );
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
    repair: buildRepairStrategy(repairSpy),
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

interface IRepairStateFixture {
  definition?: ArtifactAgentDefinition<unknown, unknown> | undefined;
  draft?: unknown;
  failures?: ArtifactGateFailure[];
  context?: ArtifactAgentContext | undefined;
  diagnostics?: IArtifactAgentDiagnostics | undefined;
  repair_iteration_count?: number;
  outcome?: 'completed' | 'failed' | undefined;
  failureMessage?: string | undefined;
}

function repairState(fixture: IRepairStateFixture): FlashcardsState {
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
    [ARTIFACT_PIPELINE_STATE_KEYS.generationModel]: undefined,
    [ARTIFACT_PIPELINE_STATE_KEYS.agentModel]: undefined,
    repair_iteration_count: fixture.repair_iteration_count ?? 0,
  } as unknown as FlashcardsState;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('repairNode', () => {
  it('bumps repair_iteration_count by exactly one on a successful repair', async () => {
    // P1 audit fix: the counter must advance on every visit. Without
    // this, `routeAfterGate`'s `>= FLASHCARDS_MAX_REPAIR_ITERATIONS`
    // check would never fire and the loop would run forever (until the
    // recursionLimit safety net kicks in at the runner).
    const definition = buildDefinition();
    const state = repairState({
      definition,
      draft: { cards: [{ q: 'Q', a: 'A' }] },
      failures: [{ gateId: 'g1', severity: 'blocker', message: 'fix me' }],
      context: buildContext(),
      diagnostics: buildDiagnostics(),
      repair_iteration_count: 0,
    });

    const result = await repairNode(state);

    expect(result?.repair_iteration_count).toBe(1);
  });

  it('advances the counter monotonically across multiple visits', async () => {
    // The reducer on `repair_iteration_count` is `keepFiniteNumber`, so
    // a missing or undefined incoming write preserves the prior value.
    // The node is responsible for writing the next value. Simulate the
    // conditional edge re-entering the repair node and confirm the
    // counter walks 1 -> 2 -> 3 rather than resetting to 1 each time.
    const definition = buildDefinition();
    const context = buildContext();
    const diagnostics = buildDiagnostics();
    const failures: ArtifactGateFailure[] = [
      { gateId: 'g1', severity: 'blocker', message: 'fix me' },
    ];

    const first = await repairNode(
      repairState({
        definition,
        draft: { cards: [] },
        failures,
        context,
        diagnostics,
        repair_iteration_count: 0,
      })
    );
    const second = await repairNode(
      repairState({
        definition,
        draft: { cards: [] },
        failures,
        context,
        diagnostics,
        repair_iteration_count: first?.repair_iteration_count ?? 0,
      })
    );
    const third = await repairNode(
      repairState({
        definition,
        draft: { cards: [] },
        failures,
        context,
        diagnostics,
        repair_iteration_count: second?.repair_iteration_count ?? 0,
      })
    );

    expect(first?.repair_iteration_count).toBe(1);
    expect(second?.repair_iteration_count).toBe(2);
    expect(third?.repair_iteration_count).toBe(3);
  });

  it('replaces the draft with the repaired draft returned by the strategy', async () => {
    const repairedDraft = { cards: [{ q: 'Q-fixed', a: 'A-fixed' }] };
    const definition = buildDefinition({
      repair: {
        repair: vi.fn(async () => repairedDraft),
      },
    });
    const state = repairState({
      definition,
      draft: { cards: [{ q: 'Q', a: 'A' }] },
      failures: [{ gateId: 'g1', severity: 'blocker', message: 'fix me' }],
      context: buildContext(),
      diagnostics: buildDiagnostics(),
      repair_iteration_count: 0,
    });

    const result = await repairNode(state);

    expect(result?.[ARTIFACT_PIPELINE_STATE_KEYS.draft]).toEqual(repairedDraft);
    expect(definition.repair?.repair).toHaveBeenCalledTimes(1);
  });

  it('forwards draft, failures, context, and diagnostics to the repair callback', async () => {
    const repairSpy = vi.fn(async (draft: unknown) => draft);
    const definition = buildDefinition({ repair: { repair: repairSpy } });
    const context = buildContext();
    const diagnostics = buildDiagnostics();
    const failures: ArtifactGateFailure[] = [
      { gateId: 'g1', severity: 'blocker', message: 'fix me' },
    ];
    const draft = { cards: [{ q: 'Q', a: 'A' }] };
    const state = repairState({
      definition,
      draft,
      failures,
      context,
      diagnostics,
      repair_iteration_count: 1,
    });

    await repairNode(state);

    expect(repairSpy).toHaveBeenCalledTimes(1);
    const args = repairSpy.mock.calls[0];
    expect(args?.[0]).toBe(draft);
    expect(args?.[1]).toBe(failures);
    expect(args?.[2]).toBe(context);
    expect(args?.[3]).toBe(diagnostics);
  });

  it('still bumps the counter when there are no gate failures', async () => {
    // The node must always increment the counter, even on a no-op visit.
    // Otherwise a gate that returned an empty failures array would
    // repeatedly re-enter the repair node and silently burn recursion
    // budget.
    const definition = buildDefinition();
    const state = repairState({
      definition,
      draft: { cards: [] },
      failures: [],
      context: buildContext(),
      diagnostics: buildDiagnostics(),
      repair_iteration_count: 0,
    });

    const result = await repairNode(state);

    expect(result?.repair_iteration_count).toBe(1);
    expect(definition.repair?.repair).not.toHaveBeenCalled();
    // The draft channel is untouched on a no-op visit so the reducer
    // preserves the previous value via the LangGraph default reducer.
    expect(result?.[ARTIFACT_PIPELINE_STATE_KEYS.draft]).toBeUndefined();
  });

  it('returns a failed outcome when the repair callback throws (P4)', async () => {
    // P4: the repair node must NOT re-throw on a repair failure. It
    // returns a partial state update with `artifact_outcome = 'failed'`
    // and the error message, while still advancing the counter so the
    // conditional edge sees the loop as having been visited.
    const llmError = new Error('repair callback failed');
    const definition = buildDefinition({
      repair: {
        repair: vi.fn(async () => {
          throw llmError;
        }),
      },
    });
    const state = repairState({
      definition,
      draft: { cards: [] },
      failures: [{ gateId: 'g1', severity: 'blocker', message: 'fix me' }],
      context: buildContext(),
      diagnostics: buildDiagnostics(),
      repair_iteration_count: 0,
    });

    const result = await repairNode(state);

    expect(result?.[ARTIFACT_PIPELINE_STATE_KEYS.outcome]).toBe('failed');
    expect(result?.[ARTIFACT_PIPELINE_STATE_KEYS.failureMessage]).toBe(
      'repair callback failed'
    );
    expect(result?.repair_iteration_count).toBe(1);
  });

  it('coerces non-Error throws to a string in the failure message', async () => {
    const definition = buildDefinition({
      repair: {
        repair: vi.fn(async () => {
          // eslint-disable-next-line @typescript-eslint/no-throw-literal
          throw 'string-only failure';
        }),
      },
    });
    const state = repairState({
      definition,
      draft: { cards: [] },
      failures: [{ gateId: 'g1', severity: 'blocker', message: 'fix me' }],
      context: buildContext(),
      diagnostics: buildDiagnostics(),
      repair_iteration_count: 0,
    });

    const result = await repairNode(state);

    expect(result?.[ARTIFACT_PIPELINE_STATE_KEYS.outcome]).toBe('failed');
    expect(result?.[ARTIFACT_PIPELINE_STATE_KEYS.failureMessage]).toBe(
      'string-only failure'
    );
  });

  it('returns a failed outcome when artifact_definition is missing', async () => {
    const state = repairState({
      definition: undefined,
      draft: { cards: [] },
      failures: [{ gateId: 'g1', severity: 'blocker', message: 'fix me' }],
      context: buildContext(),
      diagnostics: buildDiagnostics(),
      repair_iteration_count: 0,
    });

    const result = await repairNode(state);

    expect(result?.[ARTIFACT_PIPELINE_STATE_KEYS.outcome]).toBe('failed');
    expect(result?.[ARTIFACT_PIPELINE_STATE_KEYS.failureMessage]).toMatch(
      /artifact_definition/
    );
    expect(result?.repair_iteration_count).toBe(1);
  });

  it('returns a failed outcome when artifact_draft is missing', async () => {
    const state = repairState({
      definition: buildDefinition(),
      draft: undefined,
      failures: [{ gateId: 'g1', severity: 'blocker', message: 'fix me' }],
      context: buildContext(),
      diagnostics: buildDiagnostics(),
      repair_iteration_count: 0,
    });

    const result = await repairNode(state);

    expect(result?.[ARTIFACT_PIPELINE_STATE_KEYS.outcome]).toBe('failed');
    expect(result?.[ARTIFACT_PIPELINE_STATE_KEYS.failureMessage]).toMatch(
      /artifact_draft/
    );
    expect(result?.repair_iteration_count).toBe(1);
  });

  it('returns a failed outcome when definition.repair is not configured', async () => {
    // A definition that has no repair strategy must NOT silently pass
    // through. Leaving blocker failures unaddressed would let the run
    // finalize an invalid flashcards artifact.
    const definition = buildDefinition({ repair: undefined });
    const state = repairState({
      definition,
      draft: { cards: [] },
      failures: [{ gateId: 'g1', severity: 'blocker', message: 'fix me' }],
      context: buildContext(),
      diagnostics: buildDiagnostics(),
      repair_iteration_count: 0,
    });

    const result = await repairNode(state);

    expect(result?.[ARTIFACT_PIPELINE_STATE_KEYS.outcome]).toBe('failed');
    expect(result?.[ARTIFACT_PIPELINE_STATE_KEYS.failureMessage]).toMatch(
      /definition\.repair/
    );
    expect(result?.repair_iteration_count).toBe(1);
  });

  it('does not write to the generation_model or agent_model channels (P6)', async () => {
    // P6 audit fix: the repair node must NOT overwrite the model
    // channels. Those keys are written exclusively by `generate.node.ts`
    // and must remain stable across the repair loop so downstream
    // persistence reads the labels that match the original draft.
    const definition = buildDefinition();
    const state = repairState({
      definition,
      draft: { cards: [] },
      failures: [{ gateId: 'g1', severity: 'blocker', message: 'fix me' }],
      context: buildContext(),
      diagnostics: buildDiagnostics(),
      repair_iteration_count: 0,
    });

    const result = await repairNode(state);

    expect(
      result?.[ARTIFACT_PIPELINE_STATE_KEYS.generationModel]
    ).toBeUndefined();
    expect(
      result?.[ARTIFACT_PIPELINE_STATE_KEYS.agentModel]
    ).toBeUndefined();
  });

  it('treats undefined repair_iteration_count as zero on entry', async () => {
    // The reducer guarantees a finite number, so an undefined incoming
    // value should be normalized to 0 before the node bumps to 1. This
    // protects against a missing seed on the initial state.
    const definition = buildDefinition();
    const state = repairState({
      definition,
      draft: { cards: [] },
      failures: [{ gateId: 'g1', severity: 'blocker', message: 'fix me' }],
      context: buildContext(),
      diagnostics: buildDiagnostics(),
    });
    // Force the loop counter to undefined so the node's internal
    // `?? 0` fallback path is exercised.
    (state as { repair_iteration_count?: number }).repair_iteration_count =
      undefined;

    const result = await repairNode(state);

    expect(result?.repair_iteration_count).toBe(1);
  });
});