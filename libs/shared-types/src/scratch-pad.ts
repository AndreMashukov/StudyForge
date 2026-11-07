/** One recall question and hidden answer tied to a lesson h2 section. */
export interface IScratchPad {
  sectionIndex: number;
  heading: string;
  question: string;
  answer: string;
  /** Questions replaced via Generate a different question; used to avoid repeats. */
  avoidedQuestions?: string[];
}

export interface RegenerateScratchPadQuestionRequest {
  documentId: string;
  sectionIndex: number;
  ruleIds?: string[];
}

export interface RegenerateScratchPadQuestionResponse {
  scratchPad: IScratchPad;
}

export interface ClearScratchPadAvoidedQuestionsRequest {
  documentId: string;
  sectionIndex: number;
}

export interface ClearScratchPadAvoidedQuestionsResponse {
  scratchPad: IScratchPad;
}

export interface EvaluateScratchPadAnswerRequest {
  documentId: string;
  sectionIndex: number;
  userAnswer: string;
  ruleIds?: string[];
}

export interface EvaluateScratchPadAnswerResponse {
  score: number;
  hint?: string;
}
