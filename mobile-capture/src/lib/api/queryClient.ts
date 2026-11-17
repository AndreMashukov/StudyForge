import { QueryClient } from '@tanstack/react-query';
import { QUERY_CACHE_MAX_AGE_MS } from './queryPersistence';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      // Must outlive the persisted cache, or restored entries are dropped immediately.
      gcTime: QUERY_CACHE_MAX_AGE_MS,
      retry: 1,
    },
  },
});
