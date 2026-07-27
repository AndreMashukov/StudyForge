import {
  ApiResponse,
  DirectoryChatMessage,
  GetDirectoryChatRequest,
  GetDirectoryChatResponse,
  SendDirectoryChatMessageRequest,
  SendDirectoryChatMessageResponse,
  UpdateDirectoryChatSourcesRequest,
  UpdateDirectoryChatSourcesResponse,
} from '@shared-types';

export type IGetDirectoryChatRequest = GetDirectoryChatRequest;
export type IGetDirectoryChatResponse = GetDirectoryChatResponse;
export type ISendDirectoryChatMessageRequest = SendDirectoryChatMessageRequest;
export type ISendDirectoryChatMessageResponse = SendDirectoryChatMessageResponse;
export type IUpdateDirectoryChatSourcesRequest = UpdateDirectoryChatSourcesRequest;
export type IUpdateDirectoryChatSourcesResponse = UpdateDirectoryChatSourcesResponse;
export type IDirectoryChatMessage = DirectoryChatMessage;

export type IGetDirectoryChatApiResponse = IGetDirectoryChatResponse;
export type ISendDirectoryChatMessageApiResponse = ISendDirectoryChatMessageResponse;
export type IUpdateDirectoryChatSourcesApiResponse = IUpdateDirectoryChatSourcesResponse;

export interface IOptimisticDirectoryChatMessage extends DirectoryChatMessage {
  status?: 'pending' | 'failed';
}

export type IDirectoryChatCallableResponse<T> = ApiResponse<T> | T;
