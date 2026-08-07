---
description: Page context pattern, containers, and component organization
paths:
  - "web/src/components/**/*.tsx"
  - "web/src/pages/**/*.tsx"
  - "admin/src/components/**/*.tsx"
  - "admin/src/app/**/*.tsx"
---

# Component Structure

## Page Pattern (context-based)

Web feature pages follow: **Page → Provider → Container**. Admin uses Next.js App Router under `admin/src/app/` (RSC-first); still prefer named exports, `handle*` handlers, and `I*` interfaces for shared components.

```
web/src/pages/FeatureNamePage/
├── FeatureNamePage.tsx              # ProtectedRoute + Provider
├── FeatureNamePageContainer/
├── context/
│   ├── FeatureNamePageProvider.tsx  # orchestrates hooks only
│   └── hooks/
│       ├── api/useFetchFeaturePageData.ts
│       ├── useFeaturePageHandlers.ts
│       ├── useFeaturePageEffects.ts
│       └── useFeaturePageContext.ts
├── types/
└── utils/
```

## MUST Follow

1. **Providers orchestrate hooks only** — no `useState`, `useSelector`, or `useEffect` directly in providers.
2. **Containers consume context** — early return for loading/error, then render UI.
3. **Redux via `useSelector`** in components/hooks — no prop drilling of store state.
4. **Named exports** for all components.
5. **Handler prefix `handle`** (e.g., `handleSubmit`, `handleDelete`).
6. **Interface prefix `I`** (e.g., `IDocumentsPageContext`).

## Shared Component Structure

```
web/src/components/ComponentName/
├── index.ts
├── ComponentName.tsx
├── IComponentName.ts
└── ComponentName.styles.ts   # optional CVA/Tailwind constants
```

## NEVER Do

- NEVER put business logic in providers — delegate to handler/effect hooks
- NEVER duplicate RTK Query data in local `useState`
- NEVER use class components (except `ErrorBoundary`)

## Reference

- `skills/page-pattern` — full page scaffolding guide
- [AGENTS.md](../../AGENTS.md) — Architecture patterns (context-based pages)
