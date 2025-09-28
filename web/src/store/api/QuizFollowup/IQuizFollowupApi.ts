import { 
  GenerateFollowupRequest as SharedGenerateFollowupRequest,
  GenerateFollowupResponse as SharedGenerateFollowupResponse,
  ApiResponse
} from '@shared-types';

// Re-export shared types for consistency
export type IGenerateFollowupRequest = SharedGenerateFollowupRequest;
export type IGenerateFollowupResponse = SharedGenerateFollowupResponse;

// API Response wrapper types for RTK Query
export type IGenerateFollowupApiResponse = ApiResponse<IGenerateFollowupResponse>;