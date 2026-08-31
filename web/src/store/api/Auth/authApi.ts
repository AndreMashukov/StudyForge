import type {
  ApiResponse,
  IBootstrapUserProfileResponse,
  IUserProfile,
} from '@shared-types';
import { auth } from '../../../config/firebase';
import { fetchUserProfileFromFirestore } from '../../../services/userProfileFirestore';
import {
  authRequiredError,
  customError,
} from '../../../services/firestoreReadUtils';
import { baseApi } from '../baseApi';

function profileError(error: unknown) {
  return customError(error instanceof Error ? error.message : 'Failed to load user profile');
}

export const authApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getCurrentUserProfile: builder.query<IUserProfile | null, void>({
      async queryFn() {
        const userId = auth.currentUser?.uid;
        if (!userId) return authRequiredError();
        try {
          const profile = await fetchUserProfileFromFirestore(userId);
          return { data: profile };
        } catch (error) {
          return profileError(error);
        }
      },
      providesTags: ['UserProfile'],
    }),
    bootstrapUserProfile: builder.mutation<IUserProfile, void>({
      query: () => ({
        functionName: 'bootstrapUserProfile',
      }),
      transformResponse: (response: ApiResponse<IBootstrapUserProfileResponse>) => {
        if (!response.success || !response.data?.profile) {
          throw new Error('Failed to initialize user profile');
        }
        return response.data.profile;
      },
      invalidatesTags: ['UserProfile'],
    }),
  }),
});

export const {
  useBootstrapUserProfileMutation,
  useGetCurrentUserProfileQuery,
} = authApi;
