import { createApi, BaseQueryFn } from '@reduxjs/toolkit/query/react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../config/firebase';

// Custom base query that uses Firebase callable functions
const firebaseCallableBaseQuery: BaseQueryFn<
  {
    functionName: string;
    data?: unknown;
  },
  unknown,
  unknown
> = async ({ functionName, data }) => {
  try {
    console.log(`Firebase Callable - Starting: ${functionName}`);

    const callable = httpsCallable(functions, functionName);
    
    const startTime = Date.now();
    const result = await callable(data || {});
    const duration = Date.now() - startTime;
    
    console.log(`Firebase Callable - Success: ${functionName} (${duration}ms)`);

    return { data: result.data };
  } catch (error: unknown) {
    console.error(`Firebase Callable - Error: ${functionName}`, error);

    const firebaseError = error as { code?: string; message?: string };
    return {
      error: {
        status: firebaseError.code || 'UNKNOWN_ERROR',
        data: firebaseError.message || 'An unknown error occurred',
      },
    };
  }
};

// Base API configuration
export const baseApi = createApi({
  reducerPath: 'baseApi',
  baseQuery: firebaseCallableBaseQuery,
  tagTypes: ['Quiz', 'UserQuizzes', 'RecentQuizzes', 'DocumentQuizzes', 'Document'],
  endpoints: () => ({}),
});