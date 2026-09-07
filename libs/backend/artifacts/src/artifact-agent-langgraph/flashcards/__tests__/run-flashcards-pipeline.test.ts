/**
 * Runner tests for `runFlashcardsLangGraphPipeline`.
 *
 * Per Phase C of the migration spec (spec item 8: "runner test for
 * GraphRecursionError to ArtifactAgentPipelineFailedError mapping"), this
 * file is dedicated to the runner's behavior around the catch specified
 * in the LangGraph artifact pipeline rules:
 *
 *   - MUST catch `GraphRecursionError` at the runner and map it to the
 *     existing pipeline failure error (`ArtifactAgentPipelineFailedError`).
 *
 * Additional spec items exercised here:
 *   - Spec item 4 (failure-routing short-circuit): when a node writes
 *     `artifact_outcome = 'failed'`, the runner must translate the
 *     terminal outcome into `ArtifactAgentPipelineFailedError` so the
 *     short-circuit at the routing edge has a corresponding failure
 *     contract at the runner level.
 *   - Spec item 5 (initial invoke state): the runner must seed
 *     `artifact_definition`, `job_input`, the repair loop counter at
 *     zero, and the gate-failures channel as an empty array, plus
 *     diagnostics. Without this seed, `routeAfterGate`'s
 *     `< maxRepairIterations` comparison is undefined.
 *   - Spec item 6 (recursionLimit invoke config): `recursionLimit` is an
 *     invoke-time option, not a compile option. The runner must pass it
 *     via the invoke `config` argument.
 *   - Spec item 7 (thread_id = jobId): `configurable.thread_id` is bound
 *     at invoke time to the originating job id.
 *
 * Scope:
 *   - The GraphRecursionError -> ArtifactAgentPipelineFailedError mapping
 *     is the primary contract under test. The runner must translate the
 *     LangGraph-native error into the runner's existing failure contract
 *     so callers do not need a LangGraph-specific error branch.
 *   - The artifactKind guard is exercised because the runner is the
 *     dispatcher for one artifact kind only and must reject other kinds
 *     up front.
 *
 * Out of scope (covered elsewhere):
 *   - Node-level behavior (counter advancement, finalize branching,
 *     etc.) is covered in `flashcards/__tests__/*.test.ts` node tests.
 *   - Pure-function route-function tests live in
 *     `route-after-generate.test.ts` and `route-after-gate.test.ts`.
 *   - Graph topology (node registration, edges, conditional edges) is
 *     covered in `flashcards-graph.test.ts`.
 *
 * Test strategy:
 *   - We stub the module-level compiled graph (`flashcardsGraph.invoke`)
 *     so we can drive the runner without booting the full graph or
 *     requiring Firestore / LLM. This keeps the tests fast and focused
 *     on the runner's responsibilities: input validation, the seeded
 *     initial state, the recursion catch, and translation to the
 *     pipeline failure error contract.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GraphRecursionError } from '@langchain/langgraph';

import { ArtifactAgentPipelineFailedError } from '../../artifact-errors';
import type { ArtifactAgentJobInput } from '../../artifact-job-input';
import { ARTIFACT_PIPELINE_STATE_KEYS } from '../../artifact-pipeline-state-keys';

// Mock the compiled graph so the runner test does not need the full
// LangGraph runtime, Firestore, or Gemini. Each test controls whether
// `invoke` resolves, throws a GraphRecursionError, or throws another
// error, so we can isolate the runner's behavior.
vi.mock('../flashcards-graph', async () => {
  const actual = await vi.importActual<typeof import('../flashcards-graph')>(
    '../flashcards-graph'
  );
  const mockInvoke = vi.fn();
  return {
    ...actual,
    flashcardsGraph: {
      invoke: mockInvoke,
    },
    __mockInvoke: mockInvoke,
  };
});

// Mock the firebase-functions logger so the runner test does not depend on
// the Firebase Functions v2 runtime surface.
vi.mock('firebase-functions/v2', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { runFlashcardsLangGraphPipeline } from '../run-flashcards-pipeline';

// Access the mocked invoke through the mocked module. Pulling it via a
// typed module shim keeps the test readable and avoids touching the
// original module's exports.
type MockedGraphModule = typeof import('../flashcards-graph') & {
  __mockInvoke: ReturnType<typeof vi.fn>;
};
const mockedGraphModule = (await import('../flashcards-graph')) as MockedGraphModule;
const mockInvoke = mockedGraphModule.__mockInvoke;

/** Build a minimal valid flashcards job input for the runner. */
function makeJobInput(
  overrides: Partial<ArtifactAgentJobInput> = {}
): ArtifactAgentJobInput {
  return {
    artifactKind: 'flashcards',
    userId: 'user-123',
    recordId: 'record-456',
    jobId: 'job-789',
    ...overrides,
  };
}

describe('runFlashcardsLangGraphPipeline', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
  });

  it('rejects inputs whose artifactKind is not "flashcards"', async () => {
    // The flashcards runner is the dispatcher case for one artifact
    // kind only. Any other artifactKind must throw before invoking the
    // graph so a misrouted call does not silently consume a recursion
    // budget on the wrong pipeline.
    const input = makeJobInput({
      artifactKind: 'diagram_quiz' as unknown as 'flashcards',
    });

    await expect(runFlashcardsLangGraphPipeline(input)).rejects.toThrow(
      /unexpected artifactKind/i
    );
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('catches GraphRecursionError and maps it to ArtifactAgentPipelineFailedError', async () => {
    // This is the primary contract under test (spec item 8 of the
    // migration spec). When the LangGraph runtime throws
    // GraphRecursionError (the run exceeded the configured
    // recursionLimit), the runner must translate it into
    // ArtifactAgentPipelineFailedError so the caller's failure marking
    // logic stays uniform across ADK and LangGraph orchestrations.
    const input = makeJobInput();
    mockInvoke.mockRejectedValueOnce(new GraphRecursionError('recursion limit'));

    let captured: unknown;
    try {
      await runFlashcardsLangGraphPipeline(input);
    } catch (err) {
      captured = err;
    }

    expect(captured).toBeInstanceOf(ArtifactAgentPipelineFailedError);
    expect((captured as Error).message).toMatch(/recursionLimit/);
    expect((captured as Error).message).toContain(input.jobId);
    expect(mockInvoke).toHaveBeenCalledTimes(1);
  });

  it('preserves the jobId in the mapped failure message for debugging', async () => {
    // The mapped error must carry the jobId so the Firebase Functions
    // handler's failure logs can correlate the recursion-limit hit to
    // the originating generation job.
    const input = makeJobInput({ jobId: 'job-recursion-abc' });
    mockInvoke.mockRejectedValueOnce(new GraphRecursionError('boom'));

    let captured: unknown;
    try {
      await runFlashcardsLangGraphPipeline(input);
    } catch (err) {
      captured = err;
    }

    expect(captured).toBeInstanceOf(ArtifactAgentPipelineFailedError);
    expect((captured as Error).message).toContain('job-recursion-abc');
  });

  it('does not catch non-GraphRecursionError errors', async () => {
    // The runner's catch is scoped to GraphRecursionError only. Any
    // other error (a thrown TypeError, a Firestore SDK error, etc.)
    // must propagate so the Firebase Functions handler logs and marks
    // the failure with the original error type.
    const input = makeJobInput();
    const unrelatedError = new Error('unrelated failure');
    mockInvoke.mockRejectedValueOnce(unrelatedError);

    await expect(runFlashcardsLangGraphPipeline(input)).rejects.toBe(
      unrelatedError
    );
  });

  it('does not silently translate a non-Error throw into the pipeline failure', async () => {
    // Defensive: a non-Error throw (e.g. a string or an object) is not
    // a GraphRecursionError and must propagate as-is. The runner's
    // `err instanceof GraphRecursionError` guard handles this
    // naturally, but we lock the behavior in case future refactors
    // widen the catch.
    const input = makeJobInput();
    const stringThrow = 'plain string thrown';
    mockInvoke.mockRejectedValueOnce(stringThrow);

    await expect(runFlashcardsLangGraphPipeline(input)).rejects.toBe(
      stringThrow
    );
  });

  it('throws ArtifactAgentPipelineFailedError when the terminal outcome is "failed"', async () => {
    // Spec item 4 failure-routing short-circuit: when a node has
    // already marked the run as terminally failed (e.g. an
    // unrecoverable generation failure inside `generate` or `repair`),
    // the conditional edge routes straight to `finalize`. The runner
    // then translates the terminal `artifact_outcome = 'failed'` into
    // the same pipeline failure contract used elsewhere. This is a
    // separate code path from the recursion catch but produces the
    // same error class, so callers have a uniform error-handling
    // surface.
    const input = makeJobInput();
    mockInvoke.mockResolvedValueOnce({
      artifact_outcome: 'failed',
      artifact_failure_message: 'gate blocked on schema',
    });

    let captured: unknown;
    try {
      await runFlashcardsLangGraphPipeline(input);
    } catch (err) {
      captured = err;
    }

    expect(captured).toBeInstanceOf(ArtifactAgentPipelineFailedError);
    expect((captured as Error).message).toBe('gate blocked on schema');
  });

  it('falls back to a generic message when the failed outcome has no failure_message', async () => {
    // Mirrors the ADK runner's fallback behavior: when the finalize
    // node marks the run failed without writing a failure_message, the
    // runner uses a generic message so callers never see an empty
    // error string.
    const input = makeJobInput();
    mockInvoke.mockResolvedValueOnce({
      artifact_outcome: 'failed',
    });

    let captured: unknown;
    try {
      await runFlashcardsLangGraphPipeline(input);
    } catch (err) {
      captured = err;
    }

    expect(captured).toBeInstanceOf(ArtifactAgentPipelineFailedError);
    expect((captured as Error).message).toMatch(/failed/i);
  });

  it('resolves normally when the terminal outcome is "completed"', async () => {
    // The happy path: the runner resolves without throwing when the
    // finalize node writes `artifact_outcome = 'completed'`. The
    // `persistCompleted` side effect has already happened inside the
    // finalize node by this point.
    const input = makeJobInput();
    mockInvoke.mockResolvedValueOnce({
      artifact_outcome: 'completed',
    });

    await expect(
      runFlashcardsLangGraphPipeline(input)
    ).resolves.toBeUndefined();
  });

  it('throws a generic error when the terminal outcome is missing', async () => {
    // Per the runner contract: a missing terminal outcome is an
    // internal error. The runner must NOT silently resolve, because
    // that would look like a successful run to the Firebase Functions
    // handler.
    const input = makeJobInput();
    mockInvoke.mockResolvedValueOnce({});

    let captured: unknown;
    try {
      await runFlashcardsLangGraphPipeline(input);
    } catch (err) {
      captured = err;
    }

    expect(captured).toBeInstanceOf(Error);
    expect(captured).not.toBeInstanceOf(ArtifactAgentPipelineFailedError);
    expect((captured as Error).message).toMatch(/terminal outcome/i);
    expect((captured as Error).message).toContain(input.jobId);
  });

  it('passes the recursionLimit option into the graph invoke call', async () => {
    // Per spec item 6 of the migration spec: `recursionLimit` is an
    // invoke-time config option, not a compile option. The runner
    // passes it via `config.recursionLimit` at invoke time. This test
    // pins down that contract so a refactor cannot accidentally move
    // the limit to the graph compile step.
    const input = makeJobInput();
    mockInvoke.mockResolvedValueOnce({
      artifact_outcome: 'completed',
    });

    await runFlashcardsLangGraphPipeline(input);

    expect(mockInvoke).toHaveBeenCalledTimes(1);
    const [, config] = mockInvoke.mock.calls[0];
    expect(config).toBeDefined();
    expect(typeof config.recursionLimit).toBe('number');
    expect(config.recursionLimit).toBeGreaterThan(0);
  });

  it('uses a recursionLimit that bounds the worst-case super-step count with headroom', async () => {
    // Spec item 6: the recursionLimit must be a finite integer large
    // enough to cover the worst-case super-step sequence
    // (load_context + generate + gate + 2x repair loop + finalize = 6)
    // with headroom, but not so large it grants runaway looping. A
    // value below the worst-case bound would cause the catch path to
    // fire on healthy runs; a value orders of magnitude larger would
    // defeat the safety net.
    const input = makeJobInput();
    mockInvoke.mockResolvedValueOnce({
      artifact_outcome: 'completed',
    });

    await runFlashcardsLangGraphPipeline(input);

    const [, config] = mockInvoke.mock.calls[0];
    // Worst case: 6 super-steps. Require the ceiling to be > 6 (with
    // headroom) and a finite, sane integer. We use a generous upper
    // bound (50) so the test does not over-constrain future tuning
    // but still rejects accidental values like Number.MAX_SAFE_INTEGER.
    expect(config.recursionLimit).toBeGreaterThan(6);
    expect(Number.isInteger(config.recursionLimit)).toBe(true);
    expect(config.recursionLimit).toBeLessThan(50);
  });

  it('binds configurable.thread_id to the jobId at invoke time', async () => {
    // Per the LangGraph artifact pipeline rules: `configurable.thread_id`
    // is bound at invoke time, not at compile time. The runner must
    // thread the jobId through so LangGraph's tracing/checkpointer
    // surface can correlate the run.
    const input = makeJobInput({ jobId: 'job-thread-id-xyz' });
    mockInvoke.mockResolvedValueOnce({
      artifact_outcome: 'completed',
    });

    await runFlashcardsLangGraphPipeline(input);

    const [, config] = mockInvoke.mock.calls[0];
    expect(config.configurable.thread_id).toBe('job-thread-id-xyz');
  });

  it('seeds the initial state with the repair loop counter at zero', async () => {
    // Per spec item 5 of the migration spec, the runner must seed
    // `repair_iteration_count` to `0` so the first `routeAfterGate`
    // comparison is defined. The seed lives in the initial-state
    // object passed to `invoke()`; this test asserts the counter is
    // present in that object so a future refactor cannot silently
    // drop the seed.
    const input = makeJobInput();
    mockInvoke.mockResolvedValueOnce({
      artifact_outcome: 'completed',
    });

    await runFlashcardsLangGraphPipeline(input);

    const [initialState] = mockInvoke.mock.calls[0];
    expect(initialState).toBeDefined();
    expect(initialState.repair_iteration_count).toBe(0);
  });

  it('seeds the initial state with the artifact_definition channel', async () => {
    // Per spec item 5: the runner must seed `artifact_definition` so
    // the graph nodes can read the definition off state. The seed
    // value is an object (the flashcards definition) but the test
    // does not pin a particular shape because the definition factory
    // is internal; it only requires the channel to be present so
    // `loadContext` does not crash on a missing definition.
    const input = makeJobInput();
    mockInvoke.mockResolvedValueOnce({
      artifact_outcome: 'completed',
    });

    await runFlashcardsLangGraphPipeline(input);

    const [initialState] = mockInvoke.mock.calls[0];
    expect(initialState).toBeDefined();
    expect(ARTIFACT_PIPELINE_STATE_KEYS.definition in initialState).toBe(true);
    expect(
      initialState[ARTIFACT_PIPELINE_STATE_KEYS.definition]
    ).toBeDefined();
  });

  it('seeds the initial state with the job_input channel from the input', async () => {
    // Per spec item 5: the runner must seed the `job_input` channel
    // from the ArtifactAgentJobInput passed in. The downstream nodes
    // (`load_context`, `repair`) read this channel to know which
    // generation job they are servicing.
    const input = makeJobInput({ jobId: 'job-seed-input-001' });
    mockInvoke.mockResolvedValueOnce({
      artifact_outcome: 'completed',
    });

    await runFlashcardsLangGraphPipeline(input);

    const [initialState] = mockInvoke.mock.calls[0];
    expect(initialState).toBeDefined();
    const jobInput = initialState[ARTIFACT_PIPELINE_STATE_KEYS.jobInput];
    expect(jobInput).toBeDefined();
    expect(jobInput.jobId).toBe('job-seed-input-001');
    expect(jobInput.artifactKind).toBe('flashcards');
  });

  it('seeds the initial gate_failures channel as an empty array', async () => {
    // Per spec item 5: the runner must seed `artifact_gate_failures`
    // to `[]` so the first gate evaluation does not see stale
    // failures from a previous run. Without this seed, the
    // `gateFailures` channel default reducer would still produce an
    // empty array, but the test pins down the explicit seed so a
    // future refactor cannot accidentally remove it.
    const input = makeJobInput();
    mockInvoke.mockResolvedValueOnce({
      artifact_outcome: 'completed',
    });

    await runFlashcardsLangGraphPipeline(input);

    const [initialState] = mockInvoke.mock.calls[0];
    expect(initialState[ARTIFACT_PIPELINE_STATE_KEYS.gateFailures]).toEqual(
      []
    );
  });

  it('seeds the initial diagnostics channel so the graph has a typed diagnostics surface', async () => {
    // Per spec item 5: the runner must seed `artifact_diagnostics`
    // using the same shape the ADK factory uses, so node handlers can
    // record gate results without first checking whether the
    // diagnostics object exists.
    const input = makeJobInput();
    mockInvoke.mockResolvedValueOnce({
      artifact_outcome: 'completed',
    });

    await runFlashcardsLangGraphPipeline(input);

    const [initialState] = mockInvoke.mock.calls[0];
    expect(
      initialState[ARTIFACT_PIPELINE_STATE_KEYS.diagnostics]
    ).toBeDefined();
  });
});