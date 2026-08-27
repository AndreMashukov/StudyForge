import type {
  ApiResponse,
  ICreateBillingCheckoutSessionRequest,
  ICreateBillingCheckoutSessionResponse,
  ICreateBillingPortalSessionRequest,
  ICreateBillingPortalSessionResponse,
  IUpdatePayAsYouGoSettingsRequest,
  IUserBillingState,
} from '@shared-types';
import { auth } from '../../../config/firebase';
import { fetchBillingStateFromFirestore } from '../../../services/billingFirestore';
import {
  authRequiredError,
  customError,
} from '../../../services/firestoreReadUtils';
import { baseApi } from '../baseApi';

function mutationError(error: unknown) {
  return customError(error instanceof Error ? error.message : 'Unknown error');
}

export const billingApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getBillingState: builder.query<IUserBillingState, void>({
      async queryFn() {
        const userId = auth.currentUser?.uid;
        if (!userId) return authRequiredError();
        try {
          const data = await fetchBillingStateFromFirestore(userId);
          return { data };
        } catch (error) {
          return mutationError(error);
        }
      },
    }),
    createBillingCheckoutSession: builder.mutation<
      ICreateBillingCheckoutSessionResponse,
      ICreateBillingCheckoutSessionRequest
    >({
      query: (body) => ({
        functionName: 'createBillingCheckoutSession',
        data: body,
      }),
      transformResponse: (response: ApiResponse<ICreateBillingCheckoutSessionResponse>) => {
        if (!response.success || !response.data) {
          throw new Error('Failed to create billing checkout session');
        }
        return response.data;
      },
    }),
    createBillingPortalSession: builder.mutation<
      ICreateBillingPortalSessionResponse,
      ICreateBillingPortalSessionRequest
    >({
      query: (body) => ({
        functionName: 'createBillingPortalSession',
        data: body,
      }),
      transformResponse: (response: ApiResponse<ICreateBillingPortalSessionResponse>) => {
        if (!response.success || !response.data) {
          throw new Error('Failed to create billing portal session');
        }
        return response.data;
      },
    }),
    updatePayAsYouGoSettings: builder.mutation<
      IUserBillingState,
      IUpdatePayAsYouGoSettingsRequest
    >({
      query: (body) => ({
        functionName: 'updatePayAsYouGoSettings',
        data: body,
      }),
      transformResponse: (response: ApiResponse<IUserBillingState>) => {
        if (!response.success || !response.data) {
          throw new Error('Failed to update pay-as-you-go settings');
        }
        return response.data;
      },
      invalidatesTags: [],
    }),
  }),
});

export const {
  useGetBillingStateQuery,
  useCreateBillingCheckoutSessionMutation,
  useCreateBillingPortalSessionMutation,
  useUpdatePayAsYouGoSettingsMutation,
} = billingApi;
