import type { DiagramQuizQuestion } from '@shared-types';
import type { DiagramQuizGenerationResponse } from '@study-forge/backend-llm/llm';

export interface IDiagramQuizDraft extends DiagramQuizGenerationResponse {
  questions: DiagramQuizQuestion[];
}

export interface IDiagramQuizJobPayload {
  diagramQuizName?: string;
}
