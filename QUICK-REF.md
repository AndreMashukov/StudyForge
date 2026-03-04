# Quick Reference — Code Insights AI

## Dev Commands

```bash
# Start web dev server (http://localhost:4200)
yarn nx run web:dev

# Start Firebase emulators (Auth:9099, Firestore:8080, Functions:5001, Storage:9199)
yarn nx run functions:serve
# or
yarn firebase emulators:start --project demo-project

# Create a test user in Auth emulator (run after emulators are up)
curl -s -X POST 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-api-key' \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@example.com","password":"Test1234!","returnSecureToken":true}'
```

## Post-Change Validation (run in order)

```bash
NX_DAEMON=false NX_ISOLATE_PLUGINS=false yarn nx run web:typecheck
NX_DAEMON=false NX_ISOLATE_PLUGINS=false yarn nx run web:lint
NX_DAEMON=false NX_ISOLATE_PLUGINS=false yarn nx run web:build  # PRs/merges only
```

**Pre-existing warnings to ignore:**
- `web:lint` — `RuleSelector.tsx` accessible-emoji warning
- `web:build` — PostCSS `@import` order warning in `styles.css`

## NX Targets

| Project | Targets |
|---|---|
| `web` | `lint`, `build`, `dev`, `serve`, `typecheck` |
| `functions` | `lint`, `build`, `build-with-deps`, `serve` |
| `shared-types` | `build`, `lint` |

No `test` target is configured.

## Key Paths

| What | Where |
|---|---|
| Source root | `web/src/` |
| Pages | `web/src/pages/` |
| Global components | `web/src/components/` |
| shadcn/ui components | `web/src/components/ui/` |
| Redux store | `web/src/store/` |
| RTK Query APIs | `web/src/store/api/` |
| Redux slices | `web/src/store/slices/` |
| Date utils | `web/src/utils/dateUtils.ts` |
| Firebase config | `web/src/config/` |

## Tech Stack (at a glance)

- **UI:** shadcn/ui + Tailwind CSS — **not MUI**
- **Router:** React Router DOM **v6** — import from `react-router-dom`
- **State:** Redux Toolkit + RTK Query + `redux-persist`
- **Forms:** React Hook Form + Zod
- **Auth:** Firebase Authentication + `react-firebase-hooks`
- **Dates:** `date-fns` via `web/src/utils/dateUtils.ts`

## Page Structure (established pattern)

```
web/src/pages/FeaturePage/
├── index.ts
├── FeaturePage.tsx               # ProtectedRoute + Provider wrapper
├── FeaturePageContainer/
│   ├── index.ts
│   └── FeaturePageContainer.tsx  # Renders UI, reads from context
├── context/
│   ├── FeaturePageContext.ts
│   ├── FeaturePageProvider.tsx   # Orchestrates hooks only
│   └── hooks/
│       ├── api/useFetchFeatureData.ts    # RTK Query
│       ├── useFeaturePageHandlers.ts     # Mutations, no useEffect
│       └── useFeaturePageEffects.ts      # Non-fetch useEffect only
└── types/
```

Simple pages (e.g., `FlashcardsPage`) may just have `index.tsx` — full structure only when complexity warrants it.

## Component Directory Structure

```
web/src/components/ComponentName/
├── index.ts
├── ComponentName.tsx
├── IComponentName.ts       # Props interface
└── ComponentName.styles.ts # Tailwind/CVA style constants
```

## Common Patterns

### useState is OK for local UI state

```typescript
const [isOpen, setIsOpen] = useState(false);  // fine — local UI toggle
const [email, setEmail] = useState('');        // fine — controlled form input
```

Use Redux slices for state that is shared across components or needs to persist.

### Protected route

```typescript
import { Navigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { selectIsAuthenticated } from '../store/slices/authSlice';

export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const location = useLocation();
  if (!isAuthenticated) return <Navigate to="/auth" state={{ from: location }} replace />;
  return <>{children}</>;
};
```

### RTK Query API endpoint

```typescript
export const featureApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getItems: builder.query<IItemApi[], void>({
      query: () => ({ url: '/items', method: 'GET' }),
      providesTags: ['Items'],
    }),
  }),
});
export const { useGetItemsQuery } = featureApi;
```

### Date formatting

```typescript
import { formatDate, formatDateWithOptions } from '../utils/dateUtils';
formatDate(doc.createdAt);                            // "12/15/2023"
formatDateWithOptions(doc.createdAt, 'MMM d, yyyy');  // "Dec 15, 2023"
```

### cn() for conditional classes

```typescript
import { cn } from '../lib/utils';
<div className={cn('base-class', isActive && 'active-class', variant === 'lg' && 'text-lg')} />
```

## Dependencies — install at workspace root

```bash
yarn add package-name
yarn add -D package-name
yarn add package-name --ignore-engines  # Node.js version conflicts
```
