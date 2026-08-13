import {
  AgentThreadSummary,
  GetAgentThreadRequest,
  GetAgentThreadResponse,
  IAgentThreadMessage,
  ListAgentThreadsRequest,
  ListAgentThreadsResponse,
} from '@shared-types';

export type IGetAgentThreadRequest = GetAgentThreadRequest;
export type IGetAgentThreadResponse = GetAgentThreadResponse;
export type IListAgentThreadsRequest = ListAgentThreadsRequest;
export type IListAgentThreadsResponse = ListAgentThreadsResponse;
export type IAgentThreadSummary = AgentThreadSummary;
export type IStoredAgentThreadMessage = IAgentThreadMessage;
