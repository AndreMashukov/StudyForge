import { onCall } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { throwCallableError } from '@study-forge/backend-core/lib/callable-error';
import { validateVerifiedAuth } from '@study-forge/backend-core/lib/auth';
import {
  bootstrapUserProfile,
  skipOnboarding,
} from '@study-forge/backend-core/services/user-onboarding-service';
import { ensureSampleLibrary } from '@study-forge/backend-documents/sample-library/sample-library';
import type {
  ApiResponse,
  IBootstrapUserProfileResponse,
  ISkipOnboardingResponse,
  IUserProfile,
} from '@shared-types';

/** Creates the sample folder for a new account; never fails the sign-in. */
async function ensureSampleLibraryForProfile(
  profile: IUserProfile,
): Promise<IUserProfile> {
  const onboarding = profile.onboarding;
  if (
    !onboarding ||
    onboarding.status !== 'pending' ||
    onboarding.sampleClaimedAt ||
    onboarding.sampleDirectoryId
  ) {
    return profile;
  }
  try {
    const sampleDirectoryId = await ensureSampleLibrary(profile.uid);
    if (!sampleDirectoryId) {
      return profile;
    }
    return {
      ...profile,
      onboarding: { ...onboarding, sampleDirectoryId },
    };
  } catch (error) {
    logger.error('Could not create the sample library', {
      userId: profile.uid,
      message: error instanceof Error ? error.message : String(error),
    });
    return profile;
  }
}

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
        data: { profile: await ensureSampleLibraryForProfile(profile) },
      };
    } catch (error) {
      throwCallableError(error, 'Failed to initialize user profile');
    }
  },
);

export const skipOnboardingEndpoint = onCall(
  { region: 'asia-east1', cors: true },
  async (request): Promise<ApiResponse<ISkipOnboardingResponse>> => {
    try {
      const userId = await validateVerifiedAuth(request);
      const onboarding = await skipOnboarding(userId);
      if (!onboarding) {
        throw new Error('This account has no onboarding to skip.');
      }
      return { success: true, data: { onboarding } };
    } catch (error) {
      throwCallableError(error, 'Failed to skip onboarding');
    }
  },
);
