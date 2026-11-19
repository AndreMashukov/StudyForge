import {
  DEFAULT_PROMPT_DIAGRAM_DECISION_MODEL,
  type GenerationKind,
  type GenerationWorkflow,
  type LlmModality,
} from './generation-kind-metadata';
import { PRIMARY_OPENROUTER_CONNECTION_ID } from './llm-connection-ids';

export interface IGenerationRouteBackfill {
  connectionId: string;
  model: string;
  modality: LlmModality;
  workflow: GenerationWorkflow;
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

/**
 * Fills generation routes that legacy LLM setup documents may be missing:
 * - `escalation` inherits the diagram quiz connection and model (direct workflow).
 * - `scratchPadQuestion` inherits the document question route.
 * - `promptDiagramDecision` uses the default decision route.
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
  return null;
}
