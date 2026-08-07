# StudyForge — Claude Code

Thin always-on memory. Full conventions live in `AGENTS.md` (read on demand, do not `@`-import). Path-scoped rules in `.claude/rules/` load when matching files are touched. Nested `CLAUDE.md` files under `web/`, `admin/`, `functions/`, and `libs/shared-types/` load when working in those trees.

## Commands (NX from repo root)

```bash
NX_DAEMON=false NX_ISOLATE_PLUGINS=false yarn nx run web:typecheck
NX_DAEMON=false NX_ISOLATE_PLUGINS=false yarn nx run web:lint
NX_DAEMON=false NX_ISOLATE_PLUGINS=false yarn nx run admin:typecheck
NX_DAEMON=false NX_ISOLATE_PLUGINS=false yarn nx run admin:lint
NX_DAEMON=false NX_ISOLATE_PLUGINS=false yarn nx run functions:serve
```

Before reporting done: `/check` (or the typecheck + lint sequence above). Use `/check web|admin|functions` to scope.

## Must Follow

- Never use MUI — shadcn/ui + Tailwind only
- RTK Query for API calls — never `httpsCallable` in components
- Providers orchestrate hooks only — no `useState` / `useSelector` / `useEffect` in providers
- No type assertions (`as any`, `@ts-ignore`) — type guards and Zod
- Never `firebase deploy --only hosting` — push to `main`; CI deploys hosting
- Emulator `--project` MUST match `NX_PUBLIC_FIREBASE_PROJECT_ID`

## Git

**Branch naming:** `<type>/<description>/<initials>` (feat, fix, docs, chore, refactor, test, ci). Example: `feat/add-quiz-filter/am`. Set initials in `~/.claude/CLAUDE.md`.

## Domain

Read `CONTEXT.md` when exploring or naming things. Update it during `/grill-with-docs`. ADRs in `docs/adr/` (created lazily).

## Skills / Agents

| Kind | Names |
|------|--------|
| Planning | `/grill-with-docs` (user-invoked; runs grilling + domain-modeling) |
| Knowledge | `page-pattern`, `styling-system`, `firebase-emulators`, `firebase-hosting`, `interactive-html`, `lab-to-studyforge` |
| Tools | `/check`, `/format`, `/dev-bootstrap`, worktree-* |
| Agents | `web-page-scaffolder`, `functions-reviewer`, `verify-changes` |

## Docs (on demand)

| Topic | Path |
|-------|------|
| Claude setup | `.claude/SETUP.md` |
| Conventions | `AGENTS.md` |
| External API | `docs/EXTERNAL_API.md` |
| Env / emulators | `scripts/ENV_SETUP.md`, `scripts/QUICK_SETUP.md` |

## Hooks

- PreToolUse Bash: block hosting deploy / force-push / destructive rm
- PreToolUse Edit\|Write: block obvious secrets
- PostToolUse Edit\|Write: Prettier on touched source files
- Stop: remind to `/check` once when source is dirty

Cursor parity: `.cursor/rules/` (see `.cursor/rules/README.md`). Personal overrides: `CLAUDE.local.md` (gitignored) or `~/.claude/CLAUDE.md`.
