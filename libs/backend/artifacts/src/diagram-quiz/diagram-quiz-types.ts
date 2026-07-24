import type { DiagramQuizQuestion } from '@shared-types';
import type { GeminiDiagramQuizResponse } from '@study-forge/backend-llm/gemini';

export interface IDiagramQuizDraft extends GeminiDiagramQuizResponse {
  questions: DiagramQuizQuestion[];
}

export interface IDiagramQuizJobPayload {
  diagramQuizName?: string;
}
