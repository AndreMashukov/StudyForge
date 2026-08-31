import { onCall } from 'firebase-functions/v2/https';
import { throwCallableError } from '@study-forge/backend-core/lib/callable-error';
import { validateVerifiedAuth } from '@study-forge/backend-core/lib/auth';
import { bootstrapUserProfile } from '@study-forge/backend-core/services/user-onboarding-service';
import type { ApiResponse, IBootstrapUserProfileResponse } from '@shared-types';

export const bootstrapUserProfileEndpoint = onCall(
  { region: 'asia-east1', cors: true },
  async (request): Promise<ApiResponse<IBootstrapUserProfileResponse>> => {
    try {
      const userId = await validateVerifiedAuth(request);

      const profile = await bootstrapUserProfile({
        userId,
        email:
          typeof request.auth?.token?.email === 'string'
            ? request.auth.token.email
            : undefined,
        displayName:
          typeof request.auth?.token?.name === 'string'
            ? request.auth.token.name
            : undefined,
      });

      return {
        success: true,
        data: { profile },
      };
    } catch (error) {
      throwCallableError(error, 'Failed to initialize user profile');
    }
  },
);
