<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

# General Guidelines for working with Nx

- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- You have access to the Nx MCP server and its tools, use them to help the user
- When answering questions about the repository, use the `nx_workspace` tool first to gain an understanding of the workspace architecture where applicable.
- When working in individual projects, use the `nx_project_details` mcp tool to analyze and understand the specific project structure and dependencies
- For questions around nx configuration, best practices or if you're unsure, use the `nx_docs` tool to get relevant, up-to-date docs. Always use this instead of assuming things about nx configuration
- If the user needs help with an Nx configuration or project graph error, use the `nx_workspace` tool to get any errors


<!-- nx configuration end-->

---

# Code Insights AI — Coding Conventions

## Project Overview

React + TypeScript web app in an NX monorepo. All source lives in `web/src/`. UI is built with shadcn/ui and Tailwind CSS. Routing uses React Router DOM **v6**. State is managed with Redux Toolkit + RTK Query. Auth uses Firebase Authentication.

> **Never use MUI (Material UI).** This project does not have MUI as a dependency. Use shadcn/ui + Tailwind for all UI.

---

## Technology Stack

| Concern | Choice |
|---|---|
| Build | Vite + NX workspace |
| Package manager | Yarn (always install at workspace root) |
| Framework | React 19+ with TypeScript |
| UI library | shadcn/ui with Radix UI primitives |
| Styling | Tailwind CSS + CSS custom properties |
| Routing | **React Router DOM v6** (`react-router-dom`) |
| Auth | Firebase Authentication + `react-firebase-hooks` |
| State | Redux Toolkit + RTK Query + `redux-persist` |
| Icons | Lucide React |
| Forms | React Hook Form + Zod validation |
| Dates | `date-fns` via `web/src/utils/dateUtils.ts` |

---

## File and Directory Structure

### Source root: `web/src/`

```
web/src/
├── components/         # Reusable global components
│   └── ui/             # shadcn/ui components (each in its own directory)
├── config/             # App-level configuration
├── contexts/           # Shared React contexts
├── hooks/              # Shared custom hooks
├── lib/                # Utilities (cn, etc.)
├── pages/              # Feature pages (see below)
├── store/              # Redux store, slices, RTK Query APIs
├── types/              # Shared TypeScript types
└── utils/              # Utility functions (dateUtils, etc.)
```

### Page structure (established pattern)

```
web/src/pages/FeatureNamePage/
├── index.ts
├── FeatureNamePage.tsx
├── FeatureNamePageContainer/
│   ├── index.ts
│   ├── FeatureNamePageContainer.tsx
│   └── ComponentName/
│       ├── index.ts
│       ├── ComponentName.tsx
│       ├── IComponentName.ts
│       └── ComponentName.styles.ts
├── context/
│   ├── FeatureNamePageContext.ts
│   ├── FeatureNamePageProvider.tsx
│   └── hooks/
│       ├── api/
│       │   └── useFetchFeaturePageData.ts
│       ├── useFeaturePageHandlers.ts
│       ├── useFeaturePageEffects.ts
│       └── useFeaturePageContext.ts
├── types/
│   ├── IFeaturePageHandlers.ts
│   └── IFeaturePageContext.ts
└── utils/
    └── featurePageUtils.ts
```

Not all pages require the full structure. Simple pages may only need `index.tsx`.

### Component directory structure

```
web/src/components/ComponentName/
├── index.ts
├── ComponentName.tsx
├── IComponentName.ts       # Props interface (prefix with I)
└── ComponentName.styles.ts # Tailwind/CVA style constants
```

### Store structure

```
web/src/store/
├── index.ts
├── api/
│   ├── baseApi.ts
│   └── FeatureName/
│       ├── FeatureNameApi.ts
│       └── IFeatureNameApi.ts
└── slices/
    ├── authSlice.ts
    ├── uiSlice.ts
    └── featureNamePageSlice.ts
```

---

## Naming Conventions

- Components: `PascalCase`
- Pages: `FeatureNamePage`
- Containers: `FeatureNamePageContainer`
- Contexts: `FeatureNamePageContext`
- Hooks: `useFeatureName`
- Event handlers: prefix with `handle` (e.g., `handleSubmit`)
- Interfaces: prefix with `I` (e.g., `IUserProfile`)
- API response types: suffix with `Api` (e.g., `IDocumentApi`)

---

## TypeScript Guidelines

- Use interfaces for all props and data structures (prefer over `type`)
- No empty interfaces — use `Record<string, never>` or omit props entirely
- Strict typing for all functions and variables
- Separate interface files (`IComponentName.ts`) for complex types

---

## UI Components (shadcn/ui)

Available components in `web/src/components/ui/`: `Button`, `Card`/`CardHeader`/`CardTitle`/`CardDescription`/`CardContent`/`CardFooter`, `Input`, `Textarea`, `Label`, `Badge`, `Dialog`, `DropdownMenu`, `ContextMenu`, `Tabs`, `Icon`.

Button variants: `default`, `destructive`, `outline`, `secondary`, `ghost`, `link`. Sizes: `default`, `sm`, `lg`, `icon`.

Use `cn()` from `web/src/lib/utils.ts` for conditional Tailwind classes.

### Design tokens (CSS variables)

```css
--background: 0 0 0;       /* Pure black */
--foreground: 255 255 255; /* White text */
--card: 17 17 17;
--primary: 139 92 246;     /* Purple */
--accent: 34 197 94;       /* Green */
--muted: 39 39 42;
--destructive: 239 68 68;
--border: 39 39 42;
--input: 28 28 30;
--ring: 139 92 246;
--radius: 0.75rem;
```

---

## Routing — React Router DOM v6

**Always import from `react-router-dom`**, not from `react-router`.

```typescript
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useParams, useSearchParams, useLocation } from 'react-router-dom';
```

### Protected route pattern

```typescript
export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const location = useLocation();
  if (!isAuthenticated) return <Navigate to="/auth" state={{ from: location }} replace />;
  return <>{children}</>;
};
```

---

## State Management

- Use Redux slices for all global and page-level state
- Use RTK Query for all API calls — never duplicate API data in local `useState`
- `useState` is allowed for purely local UI state (controlled form inputs, open/closed toggles)
- Access Redux state with `useSelector` directly in components — do not thread it down via props
- Mutations belong in handler hooks, not in effects

---

## Architecture Patterns (context-based page)

1. **Page component** — wraps `Provider` and `ProtectedRoute`
2. **Page container** — consumes context, renders UI
3. **Context provider** — orchestrates hooks only, no business logic
4. **API hooks** (`context/hooks/api/`) — RTK Query + fetch-related `useEffect`
5. **Handler hooks** (`useFeaturePageHandlers`) — mutations, navigation, no `useEffect`
6. **Effect hooks** (`useFeaturePageEffects`) — non-fetch `useEffect` only

Do **not** put `useState`, `useSelector`, or `useEffect` directly in providers.

---

## Form Handling

- `useState` for simple controlled inputs
- React Hook Form + Zod for complex forms; always name the form instance `form`
- Validate with Zod `safeParse` before submission; collect field errors by path

---

## Authentication

Firebase Authentication via `react-firebase-hooks`. Auth state managed in Redux `authSlice`.

---

## Date Utilities

All date formatting goes through `web/src/utils/dateUtils.ts`. Never format dates inline.

---

## Dependency Management

Install all packages at the workspace root: `yarn add package-name`

---

## Code Quality Rules

- TypeScript strict mode throughout
- Functional components only (no class components except `ErrorBoundary`)
- Named exports for all components
- No comments that just describe what the code does — only explain non-obvious intent
- Use early returns for loading and error states in containers
- Write accessible markup with proper ARIA labels

---

# Worktree Playbook

- Always verify active worktrees before doing any setup or task execution: `git worktree list`
- Always execute commands from the workspace root: `/home/andrey/.openclaw/workspace/code-insights-ai`
- For fresh or incomplete worktrees, run setup first: `./scripts/setup-worktree.sh`
- Do not assume Nx is ready; verify local Nx availability with: `./node_modules/.bin/nx --version`
- Always run project tasks via Nx (do not call underlying tools directly for build/lint/test/e2e tasks)
- In this environment, prefer local Nx with daemon/plugin isolation disabled for reliability: `NX_DAEMON=false NX_ISOLATE_PLUGINS=false ./node_modules/.bin/nx run <project>:<target>`
- If setup fails with dependency/network errors (for example `ENOTFOUND registry.yarnpkg.com`), rerun setup with escalation/network-enabled execution
- If setup or task execution is interrupted, treat state as partial and re-check readiness before proceeding:
- `test -f node_modules/nx/package.json`
- rerun `./scripts/setup-worktree.sh` if Nx is missing
- When reporting validation results, explicitly call out existing warnings that are unrelated to the current change
- Keep all edits and execution scoped to the active worktree; never assume root repository state matches worktree state

# Agent Prompts

## Git Worktree Integration Agent Prompt

You are a Git worktree integration agent for this repo.

Goal:
1) Merge changes from a source worktree into target branch `codex-test`
2) Verify correctness of merged changes
3) Remove the source worktree safely

Rules:
- Never use destructive commands like `git reset --hard`.
- Never include transient files (`.nx/`, caches, logs) in commits.
- Keep commits scoped only to intended files.
- Prefer non-interactive git commands.
- If conflicts happen, stop and report exact files/conflicts.

Procedure:

1. Discover and validate worktrees
- Run: `git worktree list`
- Confirm source worktree path exists and target branch is `codex-test`.
- Record source HEAD SHA.

2. Inspect source worktree changes
- In source worktree, run:
  - `git status --short`
  - `git diff --stat`
- Stage only intended files.
- Commit in source worktree with a clear message.

3. Merge into target branch
- In main repo worktree on `codex-test`, run:
  - `git status --short` (must be clean)
  - `git cherry-pick <source_commit_sha>`
- If cherry-pick fails, report and stop for user decision.

4. Correctness checks (project-specific)
- Ensure setup/deps are present (if needed): `./scripts/setup-worktree.sh`
- Run validation with local Nx in this environment:
  - `NX_DAEMON=false NX_ISOLATE_PLUGINS=false ./node_modules/.bin/nx run web:lint`
- Report:
  - pass/fail
  - any warnings with file paths
  - whether warnings are pre-existing or introduced by merge

5. Verify final git state
- In `codex-test` worktree, run:
  - `git log --oneline -n 3`
  - `git status --short`
- Confirm merged commit is present and working tree is clean.

6. Remove source worktree
- Run:
  - `git worktree remove --force <source_worktree_path>`
  - `git worktree list`
- Confirm source worktree no longer appears.

Output format:
- Merged commit SHA on `codex-test`
- Files changed
- Validation results
- Worktree removal confirmation
- Any residual risks/issues

## Cursor Cloud specific instructions

### Architecture

NX monorepo with two apps (`web`, `functions`) and one shared library (`shared-types`). The `functions` app depends on `shared-types`, so always build via NX from the workspace root — never `cd` into app directories to run commands.

### Running commands

All tasks must be run from `/workspace` via NX:

```bash
NX_DAEMON=false NX_ISOLATE_PLUGINS=false yarn nx run <project>:<target>
```

Available targets per project (see `nx show project <name>` for full list):
- **web**: `lint`, `build`, `dev`, `serve`, `typecheck`
- **functions**: `lint`, `build`, `build-with-deps`, `serve` (builds + starts emulators)
- **shared-types**: `build`, `lint`

There is no `test` target configured for any project currently.

### Environment files

- Root `.env` — NX_PUBLIC_* vars consumed by the Vite dev server (web app). Copy from `.env.example` and set `NX_PUBLIC_USE_FIREBASE_EMULATOR=true` for local dev.
- `functions/.env` — `GEMINI_API_KEY`, `STORAGE_BUCKET`. Copy from `functions/.env.example`.
- `functions/.env.local` — local-dev overrides (same keys as `functions/.env`). The `STORAGE_BUCKET` must use the `.appspot.com` form for the Storage emulator (e.g. `<project-id>.appspot.com`); the emulator treats `.appspot.com` and `.firebasestorage.app` as separate buckets.

### Firebase Emulators

The app requires Firebase emulators for local development (Auth:9099, Firestore:8080, Functions:5001, Storage:9199, Hosting:5002). Start them with:

```bash
yarn firebase emulators:start --project "$NX_PUBLIC_FIREBASE_PROJECT_ID"
```

Or via NX: `yarn nx run functions:serve` (builds functions first, then starts emulators).

**CRITICAL**: The `--project` value MUST match the project ID the web app uses (from the `NX_PUBLIC_FIREBASE_PROJECT_ID` env var or the fallback in `web/src/config/firebase.ts`). If there is a mismatch, the Firebase Functions emulator will return 404 on CORS preflight requests and all callable functions will fail with CORS errors. In the Cloud VM, `NX_PUBLIC_FIREBASE_PROJECT_ID` is injected as a secret — always use `"$NX_PUBLIC_FIREBASE_PROJECT_ID"` (not a hardcoded `demo-project`) when starting emulators.

Java (JDK 21+) is required for the Firestore emulator — it is pre-installed in the Cloud VM.

### Env files and Vite

- Root `.env` — loaded by NX into `process.env`
- `web/.env` — loaded by Vite into `import.meta.env` (Vite's root is `web/`, NOT workspace root)
- `functions/.env` — loaded by Firebase Functions emulator

In the Cloud VM, `NX_PUBLIC_*` secrets are injected as environment variables and override `.env` file values. You still need `web/.env` for Vite to expose them to `import.meta.env`, but the injected secrets take precedence.

### Seeding test data (user + document)

Firebase Auth emulator starts empty. The recommended way to seed a user **and** a sample document is:

```bash
npx tsx scripts/seed-setup/setup-seed-data.ts
```

This script (run from the workspace root with emulators already running):
1. Creates/updates an Auth user (`test@example.com` / `Test123456!`, fixed UID `4ZBsEPIUJ4jrlylcXkg7t3sFdPZv`)
2. Writes the corresponding Firestore user document
3. Injects a "Machine Learning" document (`perfect-doc-ml`) into Firestore
4. Uploads the document's markdown content to the Storage emulator

After running, you can log in at `http://localhost:4200` with the credentials above and browse/view the seeded document in the Documents Library.

**Alternatively**, to create a bare user without a document (e.g. for quick login testing):

```bash
curl -s -X POST "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=$NX_PUBLIC_FIREBASE_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@example.com","password":"Test1234!","returnSecureToken":true}'
```

Or use the Firebase Emulator UI at `http://localhost:4000`.

### Web dev server

```bash
yarn nx run web:dev
```

Starts on `http://localhost:4200`. Requires the `.env` file with Firebase config (uses `NX_PUBLIC_` prefix for Vite).

### Known warnings

- `web:lint` produces 1 pre-existing warning in `RuleSelector.tsx` (accessible-emoji). Do NOT flag this as a new issue.
- `web:build` shows a PostCSS `@import` order warning in `styles.css` — cosmetic, does not block the build.
- Documents page shows "No documents yet" when the Firestore is empty — this is expected empty-state behavior. If it shows "Error loading content", the emulators are likely misconfigured (see Firebase Emulators section above for the project ID requirement).

### Post-Change Validation (mandatory before reporting done)

Run in order, stop on first failure:

```bash
# 1. Type check (fastest — run first)
NX_DAEMON=false NX_ISOLATE_PLUGINS=false yarn nx run web:typecheck

# 2. Lint
NX_DAEMON=false NX_ISOLATE_PLUGINS=false yarn nx run web:lint

# 3. Build (only required for PRs and merges, skip for local dev iteration)
NX_DAEMON=false NX_ISOLATE_PLUGINS=false yarn nx run web:build
```

A change is **done** only when all required checks pass. Never report success based on sub-agent output alone — run the checks yourself.
