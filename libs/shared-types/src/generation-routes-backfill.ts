import type {
  GenerationKind,
  GenerationWorkflow,
  LlmModality,
} from './generation-kind-metadata';

export interface IGenerationRouteBackfill {
  connectionId: string;
  model: string;
  modality: LlmModality;
  workflow: GenerationWorkflow;
}

/**
 * When reading legacy LLM setup documents, `escalation` may be missing.
 * Inherit the diagram quiz connection and model with a direct workflow.
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
  return null;
}
