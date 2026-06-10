# StudyForge

AI-powered study platform for documents, quizzes, flashcards, slide decks, and directory-centric learning workflows.

## Tech Stack

- NX monorepo: `web` (React 19 + Vite), `admin` (Next.js 16 App Router), `functions` (Firebase Functions v2), `extension`, `shared-types`
- Redux Toolkit + RTK Query (Firebase callable functions) in `web`
- shadcn/ui + Radix UI + Tailwind CSS 3 in `web` and `admin`
- React Router DOM v6, React Hook Form + Zod
- Firebase Auth, Firestore, Storage, Functions emulators for local dev

> **Never use MUI.** Use shadcn/ui + Tailwind for all UI.

## Directory Structure

```
web/src/           # Public SPA (Vite, port 4200)
admin/src/         # Internal admin (Next.js, port 4201, Vercel deploy)
functions/src/     # Firebase callable functions
extension/         # Browser extension (CRX)
libs/shared-types/ # Shared types between web and functions

docs/
├── tasks/         # Task-specific docs (incl. Claude setup)
├── EXTERNAL_API.md
└── PLAYWRIGHT_TESTING_GUIDE.md
```

## Coding Guidelines

- Write senior-level code: maintainable, readable, not over-engineered
- Reuse existing patterns — read `AGENTS.md` before inventing new ones
- All web source lives in `web/src/`; admin in `admin/src/`; run tasks via NX from workspace root
- Redux state: only serializable data (no Dates, Maps, Sets, class instances)
- Prefix unused variables with underscore

## Code Quality Rules (MUST follow on every task)

**Type Safety — avoid type assertions:**

- ❌ NEVER: `as any`, `as unknown`, `as Record<string, unknown>` — use type guards instead
- ❌ NEVER: `@ts-ignore`, `@ts-expect-error` — fix the actual type error
- ✅ USE: Type guards, discriminated unions, `z.infer` from Zod schemas

**UI — shadcn/ui only:**

- ❌ NEVER: MUI components or inline `<svg>` when Lucide icons exist
- ✅ USE: `web/src/components/ui/` and `admin/src/components/ui/` primitives, Lucide React icons

**Tailwind — use design tokens:**

- ❌ NEVER: arbitrary values when a token exists (`text-[#8b5cf6]`)
- ✅ USE: CSS variable tokens from `web/src/styles.css` (`bg-primary`, `text-muted-foreground`)

**Before Writing Code — CHECK existing patterns:**

- Check `web/src/types/` and `@shared-types` before creating new types
- Check `web/src/components/` for similar components to reuse or extend
- Check `web/src/store/api/` for existing RTK Query endpoints

## Commands

```bash
# Web (always via NX from workspace root)
NX_DAEMON=false NX_ISOLATE_PLUGINS=false yarn nx run web:dev        # Dev server :4200
NX_DAEMON=false NX_ISOLATE_PLUGINS=false yarn nx run web:typecheck
NX_DAEMON=false NX_ISOLATE_PLUGINS=false yarn nx run web:lint
NX_DAEMON=false NX_ISOLATE_PLUGINS=false yarn nx run web:build

# Admin (Next.js, Vercel)
NX_DAEMON=false NX_ISOLATE_PLUGINS=false yarn nx run admin:dev        # :4201
NX_DAEMON=false NX_ISOLATE_PLUGINS=false yarn nx run admin:typecheck
NX_DAEMON=false NX_ISOLATE_PLUGINS=false yarn nx run admin:lint
NX_DAEMON=false NX_ISOLATE_PLUGINS=false yarn nx run admin:build

# Functions + emulators
NX_DAEMON=false NX_ISOLATE_PLUGINS=false yarn nx run functions:serve

# Seed test data (emulators must be running)
npx tsx scripts/seed-setup/setup-seed-data.ts
```

## Documentation

| Topic            | Location |
| ---------------- | -------- |
| Full conventions | [AGENTS.md](AGENTS.md) |
| Claude setup     | [docs/tasks/15-claude-code/15-claude-setup.md](docs/tasks/15-claude-code/15-claude-setup.md) |
| External API     | [docs/EXTERNAL_API.md](docs/EXTERNAL_API.md) |
| Env setup        | [scripts/ENV_SETUP.md](scripts/ENV_SETUP.md) |
| Emulator quick start | [scripts/QUICK_SETUP.md](scripts/QUICK_SETUP.md) |

## Git Workflow

**Branch naming:** `<type>/<description>/<initials>`

- Types: feat, fix, docs, chore, refactor, test, ci
- Example: `feat/add-quiz-filter/am`
- Set your initials in `~/.claude/CLAUDE.md`

## Code Patterns

**Shared types:**

```typescript
import type { DocumentEnhanced } from '@shared-types';
```

**API naming:** `use<Action><Entity>Query/Mutation`

```typescript
useGetUserDocumentsQuery();
useCreateDocumentMutation();
```

**Page structure (web):** Page → Provider → Container (see AGENTS.md)

```typescript
export const DocumentsPage = () => (
  <ProtectedRoute>
    <DocumentsPageProvider>
      <DocumentsPageContainer />
    </DocumentsPageProvider>
  </ProtectedRoute>
);
```

**Admin app:** Next.js App Router, RSC-first. Firebase Admin SDK server-side only. Session cookie auth (`admin_session`). Requires Firebase custom claim `{"role": "admin"}`.

## Environment

| File | Loaded by | Purpose |
|------|-----------|---------|
| Root `.env` | NX / Node | `NX_PUBLIC_*` vars |
| `web/.env` | Vite | `import.meta.env` exposure |
| `admin/.env.local` | Next.js | `NEXT_PUBLIC_*` + server secrets |
| `functions/.env` | Functions emulator | `GEMINI_API_KEY`, `STORAGE_BUCKET` |

Copy from `.env.example`, `admin/.env.example`, and `functions/.env.example`. Set `NX_PUBLIC_USE_FIREBASE_EMULATOR=true` for local dev.

**CRITICAL:** Emulator `--project` must match `NX_PUBLIC_FIREBASE_PROJECT_ID`.

## Rules (Auto-Loaded)

Path-scoped rules in `.claude/rules/` activate automatically when editing matching files:

| Rule | Scope | Coverage |
|------|-------|----------|
| `typescript.md` | `**/*.ts`, `**/*.tsx` | Type safety, no assertions, `@shared-types` |
| `styling.md` | `web/src/**`, `admin/src/**` | shadcn/ui, Tailwind tokens, Lucide icons |
| `api-patterns.md` | `web/src/store/api/**`, `slices/**` | RTK Query, Firebase callables, cache tags |
| `component-structure.md` | `web/src/components/**`, `pages/**` | Page → Provider → Container pattern |
| `form-handling.md` | `pages/**`, `Form*.tsx` | React Hook Form + Zod |
| `firebase-functions.md` | `functions/src/**` | Callable endpoints, Gemini secrets |
| `production-infra.md` | `.github/workflows/**`, `firebase.json` | Hosting deploy, GitHub secrets |

## Skills Reference

Knowledge skills (loaded on demand):

| Skill | Coverage |
|-------|----------|
| `page-pattern` | Context-based page scaffolding, provider/container/hooks |
| `styling-system` | shadcn/ui, design tokens, button variants |
| `firebase-emulators` | Local emulator setup, seed data, port map |
| `firebase-hosting` | Production deploy, GitHub secrets, troubleshooting |

Tool skills:

| Skill | Coverage |
|-------|----------|
| `check` | NX typecheck + lint (CI parity) |
| `format` | Prettier on staged or specified files |
| `worktree-create` | Parallel dev worktree + `./scripts/setup-worktree.sh` |
| `worktree-list` | List all worktrees |
| `worktree-status` | Status across worktrees |
| `worktree-remove` | Safe worktree cleanup after merge |

## Formatting

CI runs lint and typecheck on all PRs. A Claude hook in `.claude/hooks/pre-commit-format.sh` auto-formats staged files on commit.

## Gotchas

1. **Never use MUI** — shadcn/ui + Tailwind only
2. **Emulator project ID** — `--project` must match `NX_PUBLIC_FIREBASE_PROJECT_ID` or callables fail with CORS 404
3. **RTK Query only** — never call `httpsCallable` from components; use API layer hooks
4. **Providers are thin** — no `useState`/`useSelector`/`useEffect` directly in providers
5. **Serializable Redux** — no Dates, Maps, Sets, or class instances in store
6. **Shared types first** — check `@shared-types` and `web/src/types/` before creating new types
7. **Dev server ports** — web **4200**, admin **4201** (not 3000)
8. **Deploy secret name** — `FIREBASE_SERVICE_ACCOUNT_STUDY_FORGE_202604` (project: `study-forge-202604`)
9. **Functions secrets** — `GEMINI_API_KEY` via `defineSecret`, not hardcoded
10. **Pre-existing lint warning** — `RuleSelector.tsx` accessible-emoji warning is known; do not flag as new
11. **Admin auth** — privileged Firestore reads via Firebase Admin SDK server-side only; never expose admin credentials client-side

## Post-Change Validation

Run in order, stop on first failure:

```bash
NX_DAEMON=false NX_ISOLATE_PLUGINS=false yarn nx run web:typecheck
NX_DAEMON=false NX_ISOLATE_PLUGINS=false yarn nx run web:lint
```

For admin changes, also run `admin:typecheck` and `admin:lint`. For functions changes, run `functions:lint` and `functions:build`.

Run `web:build` for PRs and merges. Use `/check` skill for a guided validation run.
