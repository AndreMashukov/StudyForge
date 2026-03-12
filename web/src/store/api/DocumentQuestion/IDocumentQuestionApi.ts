import { 
  AskDocumentQuestionRequest as SharedAskDocumentQuestionRequest,
  AskDocumentQuestionResponse as SharedAskDocumentQuestionResponse,
  ApiResponse
} from '@shared-types';

export type IAskDocumentQuestionRequest = SharedAskDocumentQuestionRequest;
export type IAskDocumentQuestionResponse = SharedAskDocumentQuestionResponse;

export type IAskDocumentQuestionApiResponse = ApiResponse<IAskDocumentQuestionResponse>;
