import { END, START, StateGraph } from '@langchain/langgraph';

import {
  hasBlockerFailures,
  type ArtifactGateFailure,
} from '../../artifact-definition';
import { ARTIFACT_PIPELINE_STATE_KEYS } from '../../artifact-pipeline-state-keys';
import {
  type FlashcardsState,
  FlashcardsStateAnnotation,
} from './flashcards-state';
import { finalizeNode } from './nodes/finalize.node';
import { gateNode } from './nodes/gate.node';
import { generateNode } from './nodes/generate.node';
import { loadContextNode } from './nodes/load-context.node';
import { repairNode } from './nodes/repair.node';

export const FLASHCARDS_MAX_REPAIR_ITERATIONS = 2;

export const FLASHCARDS_NODE_NAMES = {
  loadContext: 'load_context',
  generate: 'generate',
  gate: 'gate',
  repair: 'repair',
  finalize: 'finalize',
} as const;

export type FlashcardsNodeName =
  (typeof FLASHCARDS_NODE_NAMES)[keyof typeof FLASHCARDS_NODE_NAMES];

export type RouteAfterLoadContextTarget = 'generate' | 'finalize';
export type RouteAfterGenerateTarget = 'gate' | 'finalize';
export type RouteAfterGateTarget = 'repair' | 'finalize';

function readArtifactOutcome(state: FlashcardsState): string | undefined {
  const value = state[ARTIFACT_PIPELINE_STATE_KEYS.outcome];
  return typeof value === 'string' ? value : undefined;
}

function isArtifactGateFailure(value: unknown): value is ArtifactGateFailure {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  if (!('gateId' in value) || !('severity' in value) || !('message' in value)) {
    return false;
  }
  return (
    typeof value.gateId === 'string' &&
    (value.severity === 'warning' || value.severity === 'blocker') &&
    typeof value.message === 'string'
  );
}

function readGateFailures(state: FlashcardsState): ArtifactGateFailure[] {
  const channel = state[ARTIFACT_PIPELINE_STATE_KEYS.gateFailures];
  if (!Array.isArray(channel)) {
    return [];
  }
  return channel.filter(isArtifactGateFailure);
}

function readRepairIteration(state: FlashcardsState): number {
  const value = state.repair_loop_count;
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

export function routeAfterLoadContext(
  state: FlashcardsState
): RouteAfterLoadContextTarget {
  if (readArtifactOutcome(state) === 'failed') {
    return FLASHCARDS_NODE_NAMES.finalize;
  }
  return FLASHCARDS_NODE_NAMES.generate;
}

export function routeAfterGenerate(
  state: FlashcardsState
): RouteAfterGenerateTarget {
  if (readArtifactOutcome(state) === 'failed') {
    return FLASHCARDS_NODE_NAMES.finalize;
  }
  return FLASHCARDS_NODE_NAMES.gate;
}

export function routeAfterGate(state: FlashcardsState): RouteAfterGateTarget {
  if (readArtifactOutcome(state) === 'failed') {
    return FLASHCARDS_NODE_NAMES.finalize;
  }

  const failures = readGateFailures(state);
  const repairIterations = readRepairIteration(state);

  if (!hasBlockerFailures(failures)) {
    return FLASHCARDS_NODE_NAMES.finalize;
  }

  if (repairIterations >= FLASHCARDS_MAX_REPAIR_ITERATIONS) {
    return FLASHCARDS_NODE_NAMES.finalize;
  }

  return FLASHCARDS_NODE_NAMES.repair;
}

export function createFlashcardsStateGraph() {
  return new StateGraph(FlashcardsStateAnnotation)
    .addNode(FLASHCARDS_NODE_NAMES.loadContext, loadContextNode)
    .addNode(FLASHCARDS_NODE_NAMES.generate, generateNode)
    .addNode(FLASHCARDS_NODE_NAMES.gate, gateNode)
    .addNode(FLASHCARDS_NODE_NAMES.repair, repairNode)
    .addNode(FLASHCARDS_NODE_NAMES.finalize, finalizeNode)
    .addEdge(START, FLASHCARDS_NODE_NAMES.loadContext)
    .addConditionalEdges(
      FLASHCARDS_NODE_NAMES.loadContext,
      routeAfterLoadContext,
      {
        [FLASHCARDS_NODE_NAMES.generate]: FLASHCARDS_NODE_NAMES.generate,
        [FLASHCARDS_NODE_NAMES.finalize]: FLASHCARDS_NODE_NAMES.finalize,
      }
    )
    .addConditionalEdges(
      FLASHCARDS_NODE_NAMES.generate,
      routeAfterGenerate,
      {
        [FLASHCARDS_NODE_NAMES.gate]: FLASHCARDS_NODE_NAMES.gate,
        [FLASHCARDS_NODE_NAMES.finalize]: FLASHCARDS_NODE_NAMES.finalize,
      }
    )
    .addEdge(FLASHCARDS_NODE_NAMES.repair, FLASHCARDS_NODE_NAMES.gate)
    .addConditionalEdges(
      FLASHCARDS_NODE_NAMES.gate,
      routeAfterGate,
      {
        [FLASHCARDS_NODE_NAMES.repair]: FLASHCARDS_NODE_NAMES.repair,
        [FLASHCARDS_NODE_NAMES.finalize]: FLASHCARDS_NODE_NAMES.finalize,
      }
    )
    .addEdge(FLASHCARDS_NODE_NAMES.finalize, END);
}

export function compileFlashcardsGraph() {
  return createFlashcardsStateGraph().compile();
}

export const flashcardsGraph = compileFlashcardsGraph();
