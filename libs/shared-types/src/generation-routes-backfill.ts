import {
  DEFAULT_DOCUMENT_NARRATION_MODEL,
  DEFAULT_DOCUMENT_NARRATION_VOICE,
  DEFAULT_PROMPT_DIAGRAM_DECISION_MODEL,
  type GenerationKind,
  type GenerationWorkflow,
  type LlmModality,
} from './generation-kind-metadata';
import {
  PRIMARY_GEMINI_CONNECTION_ID,
  PRIMARY_OPENROUTER_CONNECTION_ID,
} from './llm-connection-ids';

export interface IGenerationRouteBackfill {
  connectionId: string;
  model: string;
  modality: LlmModality;
  workflow: GenerationWorkflow;
  voice?: string;
}

/**
 * Route used for `promptDiagramDecision` when an LLM setup document predates it.
 * Matches the model that was hardcoded before the route became configurable.
 */
export const DEFAULT_PROMPT_DIAGRAM_DECISION_ROUTE: IGenerationRouteBackfill = {
  connectionId: PRIMARY_OPENROUTER_CONNECTION_ID,
  model: DEFAULT_PROMPT_DIAGRAM_DECISION_MODEL,
  modality: 'decision',
  workflow: 'direct',
};

/** Route used for `documentNarratableDecision` when an LLM setup predates it. */
export const DEFAULT_DOCUMENT_NARRATABLE_DECISION_ROUTE: IGenerationRouteBackfill =
  {
    connectionId: PRIMARY_OPENROUTER_CONNECTION_ID,
    model: DEFAULT_PROMPT_DIAGRAM_DECISION_MODEL,
    modality: 'decision',
    workflow: 'direct',
  };

/** Route used for `documentNarration` when an LLM setup predates it. */
export const DEFAULT_DOCUMENT_NARRATION_ROUTE: IGenerationRouteBackfill = {
  connectionId: PRIMARY_GEMINI_CONNECTION_ID,
  model: DEFAULT_DOCUMENT_NARRATION_MODEL,
  modality: 'speech',
  workflow: 'direct',
  voice: DEFAULT_DOCUMENT_NARRATION_VOICE,
};

/**
 * Fills generation routes that legacy LLM setup documents may be missing:
 * - `escalation` inherits the diagram quiz connection and model (direct workflow).
 * - `scratchPadQuestion` inherits the document question route.
 * - `promptDiagramDecision` and `documentNarratableDecision` use the default decision route.
 * - `documentNarration` uses the default Gemini speech route.
 * A field that is present but invalid is never backfilled.
 */
export function backfillMissingGenerationRoute(
  kind: GenerationKind,
  route: IGenerationRouteBackfill | null,
  diagramQuizRoute: IGenerationRouteBackfill | null,
  routeFieldPresent: boolean,
  documentQuestionRoute?: IGenerationRouteBackfill | null,
): IGenerationRouteBackfill | null {
  if (route) {
    return route;
  }
  if (routeFieldPresent) {
    return null;
  }
  if (kind === 'escalation' && diagramQuizRoute) {
    return {
      ...diagramQuizRoute,
      workflow: 'direct',
    };
  }
  if (kind === 'scratchPadQuestion' && documentQuestionRoute) {
    return { ...documentQuestionRoute };
  }
  if (kind === 'promptDiagramDecision') {
    return { ...DEFAULT_PROMPT_DIAGRAM_DECISION_ROUTE };
  }
  if (kind === 'documentNarratableDecision') {
    return { ...DEFAULT_DOCUMENT_NARRATABLE_DECISION_ROUTE };
  }
  if (kind === 'documentNarration') {
    return { ...DEFAULT_DOCUMENT_NARRATION_ROUTE };
  }
  return null;
}
