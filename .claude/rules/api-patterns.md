---
description: RTK Query + Firebase callable function patterns
paths:
  - "web/src/store/api/**/*.ts"
  - "web/src/store/slices/**/*.ts"
---

# API Patterns — RTK Query + Firebase Callables

## MUST Follow

1. **MUST route all API calls** through `web/src/store/api/baseApi.ts` (`firebaseCallableBaseQuery`).
2. **MUST NOT call `httpsCallable` directly** from components or hooks outside the API layer.
3. **MUST use `providesTags` / `invalidatesTags`** for cache invalidation.
4. **MUST import shared types** from `@shared-types` for request/response contracts.
5. **MUST place mutations in handler hooks** (`use{Page}Handlers`), not in `useEffect`.
6. **MUST keep API data in RTK Query cache** — do not duplicate in Redux slices.

## Endpoint Pattern

```typescript
import { baseApi } from '../baseApi';
import type { DocumentEnhanced } from '@shared-types';

export const documentsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getDocument: builder.query<DocumentEnhanced, string>({
      query: (documentId) => ({
        functionName: 'getDocument',
        data: { documentId },
      }),
      transformResponse: (response: { success: boolean; document: DocumentEnhanced }) =>
        response.document,
      providesTags: (_result, _error, id) => [{ type: 'Document', id }],
    }),
  }),
});
```

## Naming

- API files: `web/src/store/api/{Domain}/{Domain}Api.ts`
- Hooks: `use{Action}{Entity}Query` / `use{Action}{Entity}Mutation`
- Response types: suffix with `Api` (e.g., `IDocumentApi`)

## Reference

- [AGENTS.md](../../AGENTS.md) — State management and API patterns
