import { createApi, BaseQueryFn } from '@reduxjs/toolkit/query/react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../config/firebase';
import {
  getUserFacingLlmRoutingMessage,
  normalizeGenerationErrorMessage,
} from '../../utils/llmRoutingErrors';

// Custom base query that uses Firebase callable functions
const firebaseCallableBaseQuery: BaseQueryFn<
  {
    functionName: string;
    data?: unknown;
    /** Override the default 70s client-side deadline (ms). Use for long-running functions. */
    timeout?: number;
  },
  unknown,
  unknown
> = async ({ functionName, data, timeout }) => {
  try {
    console.log(`Firebase Callable - Starting: ${functionName}`);

    const callable = httpsCallable(functions, functionName, timeout ? { timeout } : undefined);
    
    const startTime = Date.now();
    const result = await callable(data || {});
    const duration = Date.now() - startTime;
    
    console.log(`Firebase Callable - Success: ${functionName} (${duration}ms)`);

    return { data: result.data };
  } catch (error: unknown) {
    console.error(`Firebase Callable - Error: ${functionName}`, error);
    console.error(`Firebase Callable - Error JSON:`, JSON.stringify(error, null, 2));

    const firebaseError = error as { code?: string; message?: string; details?: unknown };
    console.error(`Firebase Callable - code: ${firebaseError.code}`);
    console.error(`Firebase Callable - message: ${firebaseError.message}`);
    console.error(`Firebase Callable - details:`, firebaseError.details);

    const detailsRecord =
      typeof firebaseError.details === 'object' && firebaseError.details !== null
        ? (firebaseError.details as { code?: string; message?: string })
        : undefined;

    const routingCode = detailsRecord?.code;
    const resolvedMessage =
      getUserFacingLlmRoutingMessage(routingCode, firebaseError.message) ??
      (typeof firebaseError.details === 'string' ? firebaseError.details : undefined) ??
      firebaseError.message ??
      'An unknown error occurred';

    return {
      error: {
        status: firebaseError.code || 'UNKNOWN_ERROR',
        data: {
          message: normalizeGenerationErrorMessage(resolvedMessage),
          code: routingCode ?? firebaseError.code,
          details: firebaseError.details,
        },
      },
    };
  }
};

// Base API configuration
export const baseApi = createApi({
  reducerPath: 'baseApi',
  baseQuery: firebaseCallableBaseQuery,
  tagTypes: ['Quiz', 'UserQuizzes', 'DocumentQuizzes', 'Document', 'Directory', 'DirectoryChat', 'Documents', 'Rules', 'DirectoryRules', 'FlashcardSet', 'UserFlashcardSets', 'SlideDeck', 'UserSlideDecks', 'DiagramQuiz', 'UserDiagramQuizzes', 'SequenceQuiz', 'UserSequenceQuizzes', 'SubjectWorld', 'UserSubjectWorlds', 'InteractionStats', 'LearningStats', 'Statistics', 'ApiKeys'],
  endpoints: () => ({}),
});