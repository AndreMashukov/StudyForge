import type { QuestionKnowledgeMetadata, SubjectWorldSpec } from '@shared-types';

export interface QuizGenerationResponse {
  title: string;
  questions: Array<{
    question: string;
    options: string[];
    correctAnswer: number;
    explanation: string;
    hint?: string;
    knowledge?: QuestionKnowledgeMetadata;
  }>;
}

export interface DiagramQuizGenerationResponse {
  title: string;
  questions: Array<{
    question: string;
    diagrams: string[];
    correctAnswer: number;
    explanation: string;
    hint?: string;
    diagramLabels?: string[];
    knowledge?: QuestionKnowledgeMetadata;
  }>;
}

export interface SequenceQuizGenerationResponse {
  title: string;
  questions: Array<{
    question: string;
    items: string[];
    explanation: string;
    hint?: string;
    knowledge?: QuestionKnowledgeMetadata;
  }>;
}

export type SubjectWorldGenerationResponse = SubjectWorldSpec;

/** @deprecated Use QuizGenerationResponse */
export type GeminiQuizResponse = QuizGenerationResponse;

/** @deprecated Use DiagramQuizGenerationResponse */
export type GeminiDiagramQuizResponse = DiagramQuizGenerationResponse;

/** @deprecated Use SequenceQuizGenerationResponse */
export type GeminiSequenceQuizResponse = SequenceQuizGenerationResponse;

/** @deprecated Use SubjectWorldGenerationResponse */
export type GeminiSubjectWorldResponse = SubjectWorldGenerationResponse;
