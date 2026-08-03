import type { QuestionKnowledgeMetadata, SubjectWorldSpec } from '@shared-types';

export interface IQuizGenerationQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  hint?: string;
  knowledge?: QuestionKnowledgeMetadata;
}

export interface IQuizGenerationResponse {
  title: string;
  questions: IQuizGenerationQuestion[];
}

export interface IDiagramQuizGenerationQuestion {
  question: string;
  diagrams: string[];
  correctAnswer: number;
  explanation: string;
  hint?: string;
  diagramLabels?: string[];
  knowledge?: QuestionKnowledgeMetadata;
}

export interface IDiagramQuizGenerationResponse {
  title: string;
  questions: IDiagramQuizGenerationQuestion[];
}

export interface ISequenceQuizGenerationQuestion {
  question: string;
  items: string[];
  explanation: string;
  hint?: string;
  knowledge?: QuestionKnowledgeMetadata;
}

export interface ISequenceQuizGenerationResponse {
  title: string;
  questions: ISequenceQuizGenerationQuestion[];
}

export type ISubjectWorldGenerationResponse = SubjectWorldSpec;

export type QuizGenerationResponse = IQuizGenerationResponse;
export type DiagramQuizGenerationResponse = IDiagramQuizGenerationResponse;
export type SequenceQuizGenerationResponse = ISequenceQuizGenerationResponse;
export type SubjectWorldGenerationResponse = ISubjectWorldGenerationResponse;

/** @deprecated Use IQuizGenerationResponse */
export type GeminiQuizResponse = IQuizGenerationResponse;

/** @deprecated Use IDiagramQuizGenerationResponse */
export type GeminiDiagramQuizResponse = IDiagramQuizGenerationResponse;

/** @deprecated Use ISequenceQuizGenerationResponse */
export type GeminiSequenceQuizResponse = ISequenceQuizGenerationResponse;

/** @deprecated Use ISubjectWorldGenerationResponse */
export type GeminiSubjectWorldResponse = ISubjectWorldGenerationResponse;
