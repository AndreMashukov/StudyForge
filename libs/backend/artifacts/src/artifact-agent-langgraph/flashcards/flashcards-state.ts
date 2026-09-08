/**
 * LangGraph state schema for the flashcards artifact pipeline.
 *
 * Durable channel names come from `ARTIFACT_PIPELINE_STATE_KEYS`. The
 * `repair_loop_count` counter is flashcards-only and drives the repair loop
 * conditional edge.
 */
import { Annotation } from '@langchain/langgraph';
import type { IArtifactAgentDiagnostics } from '@shared-types';
import type {
  ArtifactAgentContext,
  ArtifactAgentDefinition,
  ArtifactAgentJobInput,
  ArtifactGateFailure,
} from '../../artifact-definition';
import { ARTIFACT_PIPELINE_STATE_KEYS } from '../../artifact-pipeline-state-keys';
import type { IFlashcardDraft, IFlashcardJobPayload } from '../../flashcards/flashcard-types';

export type FlashcardsDefinition = ArtifactAgentDefinition<
  IFlashcardDraft,
  IFlashcardJobPayload
>;

export type ArtifactPipelineOutcome = 'completed' | 'failed';

export function replaceWithNext<T>(
  current: T | undefined,
  incoming: T | undefined
): T | undefined {
  if (incoming === undefined) {
    return current;
  }
  return incoming;
}

export function keepFiniteNumber(
  current: number | undefined,
  incoming: number | undefined
): number {
  if (typeof incoming === 'number' && Number.isFinite(incoming)) {
    return incoming;
  }
  return typeof current === 'number' ? current : 0;
}

export const FLASHCARDS_LOOP_COUNTERS = {
  repair: 'repair_loop_count',
} as const;

export const FlashcardsStateAnnotation = Annotation.Root({
  [ARTIFACT_PIPELINE_STATE_KEYS.definition]:
    Annotation<FlashcardsDefinition>(),
  [ARTIFACT_PIPELINE_STATE_KEYS.jobInput]:
    Annotation<ArtifactAgentJobInput<IFlashcardJobPayload>>(),
  [ARTIFACT_PIPELINE_STATE_KEYS.context]:
    Annotation<ArtifactAgentContext>(),
  [ARTIFACT_PIPELINE_STATE_KEYS.draft]:
    Annotation<IFlashcardDraft | undefined>(),
  [ARTIFACT_PIPELINE_STATE_KEYS.diagnostics]: Annotation<
    IArtifactAgentDiagnostics | undefined
  >({
    reducer: (current, incoming) => replaceWithNext(current, incoming),
    default: () => undefined,
  }),
  [ARTIFACT_PIPELINE_STATE_KEYS.gateFailures]: Annotation<
    ArtifactGateFailure[] | undefined
  >({
    reducer: (current, incoming) => replaceWithNext(current, incoming),
    default: () => [],
  }),
  [ARTIFACT_PIPELINE_STATE_KEYS.outcome]: Annotation<
    ArtifactPipelineOutcome | undefined
  >(),
  [ARTIFACT_PIPELINE_STATE_KEYS.failureMessage]: Annotation<
    string | undefined
  >(),
  [ARTIFACT_PIPELINE_STATE_KEYS.generationModel]: Annotation<
    string | undefined
  >(),
  [ARTIFACT_PIPELINE_STATE_KEYS.agentModel]: Annotation<
    string | undefined
  >(),

  repair_loop_count: Annotation<number>({
    reducer: (current, incoming) => keepFiniteNumber(current, incoming),
    default: () => 0,
  }),
});

export type FlashcardsState = typeof FlashcardsStateAnnotation.State;

export const FlashcardsStateValue = FlashcardsStateAnnotation;

export function createInitialFlashcardsState(input: {
  definition: FlashcardsDefinition;
  jobInput: ArtifactAgentJobInput<IFlashcardJobPayload>;
  diagnostics: IArtifactAgentDiagnostics;
}): Partial<FlashcardsState> {
  return {
    [ARTIFACT_PIPELINE_STATE_KEYS.definition]: input.definition,
    [ARTIFACT_PIPELINE_STATE_KEYS.jobInput]: input.jobInput,
    [ARTIFACT_PIPELINE_STATE_KEYS.diagnostics]: input.diagnostics,
    [ARTIFACT_PIPELINE_STATE_KEYS.gateFailures]: [],
    [FLASHCARDS_LOOP_COUNTERS.repair]: 0,
  };
}
