---
name: page-pattern
description: Context-based page architecture for StudyForge — Provider, Container, handler/effect hooks, RTK Query integration
---

# Page Pattern

## Scaffold Checklist

When creating or extending a feature page:

- [ ] `FeatureNamePage.tsx` — `ProtectedRoute` + `FeatureNamePageProvider` + `FeatureNamePageContainer`
- [ ] `context/FeatureNamePageProvider.tsx` — orchestrates hooks only
- [ ] `context/hooks/api/useFetchFeaturePageData.ts` — RTK Query + fetch effects
- [ ] `context/hooks/useFeaturePageHandlers.ts` — mutations, navigation (no `useEffect`)
- [ ] `context/hooks/useFeaturePageEffects.ts` — non-fetch `useEffect` only
- [ ] `context/hooks/useFeaturePageContext.ts` — context consumer hook
- [ ] `types/IFeaturePageContext.ts` + `IFeaturePageHandlers.ts`
- [ ] RTK Query endpoints in `web/src/store/api/{Domain}/`

## Provider Rules

```typescript
// Provider orchestrates hooks — no useState, useSelector, useEffect directly
export const DocumentsPageProvider = ({ children }: { children: React.ReactNode }) => {
  const api = useFetchDocumentsPageData();
  const handlers = useDocumentsPageHandlers();
  const effects = useDocumentsPageEffects();
  // compose context value from hook returns
};
```

## Container Rules

```typescript
export const DocumentsPageContainer = () => {
  const { documents, isLoading, error, handleCreate } = useDocumentsPageContext();
  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState error={error} />;
  return (/* UI */);
};
```

## Data Flow

```
Container → Context → Handler hooks → RTK Query mutations
                    → API hooks → RTK Query queries → Firebase callable
                    → Effect hooks → side effects (non-fetch)
```

## Reference

- [AGENTS.md](../../AGENTS.md) — Architecture patterns and state management
- `.claude/rules/component-structure.md`
- `.claude/rules/api-patterns.md`
