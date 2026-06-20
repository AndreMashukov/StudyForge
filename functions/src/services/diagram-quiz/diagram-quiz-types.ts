import type { DiagramQuizQuestion } from '@shared-types';
import type { GeminiDiagramQuizResponse } from '../gemini';

export interface IDiagramQuizDraft extends GeminiDiagramQuizResponse {
  questions: DiagramQuizQuestion[];
}

export interface IDiagramQuizJobPayload {
  diagramQuizName?: string;
}
