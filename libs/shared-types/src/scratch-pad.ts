/** One recall question and hidden answer tied to a lesson h2 section. */
export interface IScratchPad {
  sectionIndex: number;
  heading: string;
  question: string;
  answer: string;
}

export interface RegenerateScratchPadQuestionRequest {
  documentId: string;
  sectionIndex: number;
  ruleIds?: string[];
  /** When true, generate from section content only without avoiding the current question. */
  ignorePrevious?: boolean;
}

export interface RegenerateScratchPadQuestionResponse {
  scratchPad: IScratchPad;
}
