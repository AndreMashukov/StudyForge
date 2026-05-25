import {
  ApiResponse,
  DirectoryChatMessage,
  GetDirectoryChatRequest,
  GetDirectoryChatResponse,
  SendDirectoryChatMessageRequest,
  SendDirectoryChatMessageResponse,
} from '@shared-types';

export type IGetDirectoryChatRequest = GetDirectoryChatRequest;
export type IGetDirectoryChatResponse = GetDirectoryChatResponse;
export type ISendDirectoryChatMessageRequest = SendDirectoryChatMessageRequest;
export type ISendDirectoryChatMessageResponse = SendDirectoryChatMessageResponse;
export type IDirectoryChatMessage = DirectoryChatMessage;

export type IGetDirectoryChatApiResponse = IGetDirectoryChatResponse;
export type ISendDirectoryChatMessageApiResponse = ISendDirectoryChatMessageResponse;

export interface IOptimisticDirectoryChatMessage extends DirectoryChatMessage {
  status?: 'pending' | 'failed';
}

export type IDirectoryChatCallableResponse<T> = ApiResponse<T> | T;
