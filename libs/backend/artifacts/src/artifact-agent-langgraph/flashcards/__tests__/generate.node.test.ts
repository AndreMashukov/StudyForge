/**
 * Node-level tests for `generate.node.ts` in the flashcards LangGraph
 * pipeline.
 *
 * These tests target the `generate` node directly (not via the compiled
 * graph). They exercise the behaviors the migration spec calls out as
 * non-negotiable:
 *
 *   - P6: the generate node is the ONLY node that writes
 *     `artifact_generation_model` and `artifact_agent_model`. Both keys
 *     are written together with the same label, and the label reflects
 *     the actual model that produced the draft (read from
 *     `diagnostics.modelUsage`).
 *   - P4: when the underlying LLM call throws, the node must NOT
 *     re-throw. It must return a partial state update that sets
 *     `artifact_outcome = 'failed'` and carries the error message via
 *     `artifact_failure_message`, so the conditional edge
 *     `routeAfterGenerate` can short-circuit to `finalize`.
 *   - The node validates required state channels (`artifact_context`,
 *     `artifact_definition`) and converts a missing channel into a
 *     `failed` outcome rather than a thrown exception.
 *
 * The LLM and the route resolver are mocked with `vi.mock` so the test
 * stays in-process and does not touch Firestore. The mocks sit at the
 * `@study-forge/backend-llm/llm` boundary; the node never imports
 * provider SDKs directly (per the LangGraph artifact pipeline rules).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the LLM boundary BEFORE importing the node. The node imports
// `formatGenerationModelLabel` and `LlmGenerationRouteResolver` from
// `@study-forge/backend-llm/llm`; both are mocked at module boundary so
// the test does not perform any network calls or read any secrets.
vi.mock('@study-forge/backend-llm/llm', () => {
  return {
    formatGenerationModelLabel: vi.fn(
      (route: { provider: string; model: string }) =>
        `${route.provider}:${route.model}`
    ),
    LlmGenerationRouteResolver: {
      resolve: vi.fn(async () => ({
        route: { provider: 'mock-provider', model: 'mock-model' },
      })),
    },
  };
});

// Import the mocked module so the tests can assert on call counts.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import {
  formatGenerationModelLabel,
  LlmGenerationRouteResolver,
} from '@study-forge/backend-llm/llm';

import type { IArtifactAgentDiagnostics } from '@shared-types';

import type {
  ArtifactAgentContext,
  ArtifactAgentDefinition,
} from '../artifact-definition';
import type { ArtifactAgentJobInput } from '../artifact-job-input';
import { ARTIFACT_PIPELINE_STATE_KEYS } from '../artifact-pipeline-state-keys';
import { generateNode } from '../nodes/generate.node';
import type { FlashcardsState } from '../flashcards-state';

/**
 * Minimal fixtures for tests. The state type requires every channel; the
 * fixtures below only fill the channels the generate node reads and
 * writes. The cast through `unknown` is intentional and mirrors the
 * diagram-quiz test pattern.
 */
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
    generate: vi.fn(async () => ({ cards: [{ q: 'Q', a: 'A' }] })),
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

interface IGenerateStateFixture {
  context?: ArtifactAgentContext | undefined;
  definition?: ArtifactAgentDefinition<unknown, unknown> | undefined;
  diagnostics?: IArtifactAgentDiagnostics | undefined;
  draft?: unknown;
  generationModel?: string | undefined;
  agentModel?: string | undefined;
  outcome?: 'completed' | 'failed' | undefined;
  failureMessage?: string | undefined;
}

function generateState(
  fixture: IGenerateStateFixture
): FlashcardsState {
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
    [ARTIFACT_PIPELINE_STATE_KEYS.gateFailures]: [],
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

describe('generateNode', () => {
  it('returns the draft and writes both model labels on the happy path', async () => {
    const diagnostics = buildDiagnostics();
    const definition = buildDefinition({
      generate: vi.fn(async () => ({ cards: [{ q: 'Q1', a: 'A1' }] })),
    });
    const state = generateState({
      context: buildContext(),
      definition,
      diagnostics,
    });

    const result = await generateNode(state);

    expect(definition.generate).toHaveBeenCalledTimes(1);
    expect(result).toBeDefined();
    expect(result?.[ARTIFACT_PIPELINE_STATE_KEYS.draft]).toEqual({
      cards: [{ q: 'Q1', a: 'A1' }],
    });
    // P6: both model labels must be written together. The label is sourced
    // from `diagnostics.modelUsage` first; with no `generator` usage
    // recorded, the node falls back to the resolved route label.
    expect(
      result?.[ARTIFACT_PIPELINE_STATE_KEYS.generationModel]
    ).toBeDefined();
    expect(
      result?.[ARTIFACT_PIPELINE_STATE_KEYS.agentModel]
    ).toBeDefined();
    expect(result?.[ARTIFACT_PIPELINE_STATE_KEYS.generationModel]).toBe(
      result?.[ARTIFACT_PIPELINE_STATE_KEYS.agentModel]
    );
  });

  it('prefers the recorded generator model over the resolved route label', async () => {
    // P6 audit fix: when `definition.generate` records a `generator` model
    // in `diagnostics.modelUsage`, the node must label both the
    // generation-model and the agent-model channels with that recorded
    // value. Falling back to the resolved primary route would mis-label
    // the artifact when the live call used a fallback route.
    const diagnostics: IArtifactAgentDiagnostics = {
      ...buildDiagnostics(),
      modelUsage: [
        {
          role: 'generator',
          provider: 'fallback-provider',
          model: 'fallback-model',
        },
      ],
    };
    const definition = buildDefinition();
    const state = generateState({
      context: buildContext(),
      definition,
      diagnostics,
    });

    const result = await generateNode(state);

    expect(result?.[ARTIFACT_PIPELINE_STATE_KEYS.generationModel]).toBe(
      'fallback-provider:fallback-model'
    );
    expect(result?.[ARTIFACT_PIPELINE_STATE_KEYS.agentModel]).toBe(
      'fallback-provider:fallback-model'
    );
    // The route resolver must NOT be consulted when a recorded generator
    // usage is available; otherwise we would double-spend a network call
    // and overwrite the recorded label.
    expect(LlmGenerationRouteResolver.resolve).not.toHaveBeenCalled();
  });

  it('falls back to the resolved route label when no generator usage is recorded', async () => {
    const diagnostics = buildDiagnostics();
    const definition = buildDefinition();
    const state = generateState({
      context: buildContext(),
      definition,
      diagnostics,
    });

    const result = await generateNode(state);

    expect(LlmGenerationRouteResolver.resolve).toHaveBeenCalledTimes(1);
    expect(formatGenerationModelLabel).toHaveBeenCalled();
    expect(result?.[ARTIFACT_PIPELINE_STATE_KEYS.generationModel]).toBe(
      'mock-provider:mock-model'
    );
    expect(result?.[ARTIFACT_PIPELINE_STATE_KEYS.agentModel]).toBe(
      'mock-provider:mock-model'
    );
  });

  it('returns a failed outcome when the underlying LLM call throws (P4)', async () => {
    // P4: nodes must NOT re-throw on a generation failure. The node
    // returns a partial state update with `artifact_outcome = 'failed'`
    // and an `artifact_failure_message` carrying the error so the
    // conditional edge from `generate` can route straight to `finalize`.
    const llmError = new Error('Gemini rate limit exceeded');
    const definition = buildDefinition({
      generate: vi.fn(async () => {
        throw llmError;
      }),
    });
    const state = generateState({
      context: buildContext(),
      definition,
      diagnostics: buildDiagnostics(),
    });

    const result = await generateNode(state);

    expect(result).toBeDefined();
    expect(result?.[ARTIFACT_PIPELINE_STATE_KEYS.outcome]).toBe('failed');
    expect(result?.[ARTIFACT_PIPELINE_STATE_KEYS.failureMessage]).toBe(
      'Gemini rate limit exceeded'
    );
    // The draft channel must NOT be populated when the LLM call fails;
    // otherwise downstream nodes would have a stale draft to inspect.
    expect(result?.[ARTIFACT_PIPELINE_STATE_KEYS.draft]).toBeUndefined();
  });

  it('coerces non-Error throws to a string in the failure message', async () => {
    const definition = buildDefinition({
      generate: vi.fn(async () => {
        // eslint-disable-next-line @typescript-eslint/no-throw-literal
        throw 'string-only failure';
      }),
    });
    const state = generateState({
      context: buildContext(),
      definition,
      diagnostics: buildDiagnostics(),
    });

    const result = await generateNode(state);

    expect(result?.[ARTIFACT_PIPELINE_STATE_KEYS.outcome]).toBe('failed');
    expect(result?.[ARTIFACT_PIPELINE_STATE_KEYS.failureMessage]).toBe(
      'string-only failure'
    );
  });

  it('returns a failed outcome when artifact_context is missing', async () => {
    const definition = buildDefinition();
    const state = generateState({
      context: undefined,
      definition,
      diagnostics: buildDiagnostics(),
    });

    const result = await generateNode(state);

    expect(result?.[ARTIFACT_PIPELINE_STATE_KEYS.outcome]).toBe('failed');
    expect(result?.[ARTIFACT_PIPELINE_STATE_KEYS.failureMessage]).toMatch(
      /artifact_context/
    );
    // The LLM must never be invoked when the required context is absent.
    expect(definition.generate).not.toHaveBeenCalled();
  });

  it('returns a failed outcome when artifact_definition is missing', async () => {
    const state = generateState({
      context: buildContext(),
      definition: undefined,
      diagnostics: buildDiagnostics(),
    });

    const result = await generateNode(state);

    expect(result?.[ARTIFACT_PIPELINE_STATE_KEYS.outcome]).toBe('failed');
    expect(result?.[ARTIFACT_PIPELINE_STATE_KEYS.failureMessage]).toMatch(
      /artifact_definition/
    );
  });

  it('passes diagnostics through to definition.generate', async () => {
    // The diagnostics channel is a parameter to the LLM call so the
    // model-usage audit can record the generator's request. The node
    // must forward the diagnostics object unchanged.
    const diagnostics = buildDiagnostics();
    const generateSpy = vi.fn(async () => ({ cards: [] }));
    const definition = buildDefinition({ generate: generateSpy });
    const state = generateState({
      context: buildContext(),
      definition,
      diagnostics,
    });

    await generateNode(state);

    expect(generateSpy).toHaveBeenCalledTimes(1);
    const passedDiagnostics = generateSpy.mock.calls[0]?.[1];
    expect(passedDiagnostics).toBe(diagnostics);
  });

  it('does not write to the loop counter (loop counters are owned by repair)', async () => {
    // P6 audit: the generate node is upstream of the repair loop and
    // must not mutate `repair_iteration_count`. The repair counter is
    // bumped by the repair node only, so the conditional edge can rely
    // on a deterministic 0 -> 1 -> 2 progression.
    const definition = buildDefinition();
    const state = generateState({
      context: buildContext(),
      definition,
      diagnostics: buildDiagnostics(),
    });

    const result = await generateNode(state);

    expect(result?.repair_iteration_count).toBeUndefined();
  });

  it('does not touch gate failures or failure message channels on success', async () => {
    const definition = buildDefinition();
    const state = generateState({
      context: buildContext(),
      definition,
      diagnostics: buildDiagnostics(),
    });

    const result = await generateNode(state);

    expect(result?.[ARTIFACT_PIPELINE_STATE_KEYS.gateFailures]).toBeUndefined();
    // On a successful run, the failure message channel is intentionally
    // untouched. Finalize is the only node that may set / clear it.
    expect(
      result?.[ARTIFACT_PIPELINE_STATE_KEYS.failureMessage]
    ).toBeUndefined();
  });
});