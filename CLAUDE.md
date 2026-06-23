[@AGENTS.md](AGENTS.md)

## Claude Code

Claude-specific configuration for this repo. Shared coding conventions load from AGENTS.md above.

### Git Workflow

**Branch naming:** `<type>/<description>/<initials>`

- Types: feat, fix, docs, chore, refactor, test, ci
- Example: `feat/add-quiz-filter/am`
- Set your initials in `~/.claude/CLAUDE.md`

### Documentation

| Topic | Location |
| ----- | -------- |
| Claude setup | [docs/tasks/15-claude-code/15-claude-setup.md](docs/tasks/15-claude-code/15-claude-setup.md) |
| External API | [docs/EXTERNAL_API.md](docs/EXTERNAL_API.md) |
| Env setup | [scripts/ENV_SETUP.md](scripts/ENV_SETUP.md) |
| Emulator quick start | [scripts/QUICK_SETUP.md](scripts/QUICK_SETUP.md) |

### Rules (Auto-Loaded)

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

Cursor IDE equivalents live in `.cursor/rules/*.mdc` (see [`.cursor/rules/README.md`](.cursor/rules/README.md)). `studyforge-core.mdc` is always applied and summarizes the essentials for Cursor.

### Domain Language

`CONTEXT.md` at the repo root is the project glossary — domain terms only, no implementation details. Read it when exploring or naming things; update it during `/grill-with-docs` sessions. ADRs live in `docs/adr/` (created lazily).

### Skills Reference

Planning skills (user-invoked):

| Skill | Coverage |
|-------|----------|
| `grill-with-docs` | Relentless plan interview + inline `CONTEXT.md` / ADR updates |

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
| `dev-bootstrap` | Full local stack: env init, emulators, seed, web dev |
| `worktree-create` | Parallel dev worktree + `./scripts/setup-worktree.sh` |
| `worktree-list` | List all worktrees |
| `worktree-status` | Status across worktrees |
| `worktree-remove` | Safe worktree cleanup after merge |

### Formatting

CI runs lint and typecheck on all PRs. A Claude hook in `.claude/hooks/pre-commit-format.sh` auto-formats staged files on commit. Use the `/check` skill for a guided validation run; see AGENTS.md for the full validation command sequence.
