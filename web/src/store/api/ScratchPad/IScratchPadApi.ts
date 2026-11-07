import type {
  ApiResponse,
  ClearScratchPadAvoidedQuestionsRequest,
  ClearScratchPadAvoidedQuestionsResponse,
  EvaluateScratchPadAnswerRequest,
  EvaluateScratchPadAnswerResponse,
  RegenerateScratchPadQuestionRequest,
  RegenerateScratchPadQuestionResponse,
} from '@shared-types';

export type IRegenerateScratchPadQuestionRequest =
  RegenerateScratchPadQuestionRequest;
export type IRegenerateScratchPadQuestionResponse =
  RegenerateScratchPadQuestionResponse;

export type IRegenerateScratchPadQuestionApiResponse =
  ApiResponse<IRegenerateScratchPadQuestionResponse>;

export type IClearScratchPadAvoidedQuestionsRequest =
  ClearScratchPadAvoidedQuestionsRequest;
export type IClearScratchPadAvoidedQuestionsApiResponse =
  ApiResponse<ClearScratchPadAvoidedQuestionsResponse>;

export type IEvaluateScratchPadAnswerRequest = EvaluateScratchPadAnswerRequest;
export type IEvaluateScratchPadAnswerApiResponse =
  ApiResponse<EvaluateScratchPadAnswerResponse>;
