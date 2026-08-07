# Cursor Rules — StudyForge

Path-scoped rules that mirror [`.claude/rules/`](../../.claude/rules/) for Cursor IDE parity with Claude Code.

## Rule Map

| Cursor rule | Claude equivalent | Scope |
|-------------|-------------------|-------|
| `studyforge-core.mdc` | Root `CLAUDE.md` (thin always-on) | Always apply |
| `typescript.mdc` | `.claude/rules/typescript.md` | All `.ts`/`.tsx` |
| `styling.mdc` | `.claude/rules/styling.md` | `web/src/**`, `admin/src/**` |
| `api-patterns.mdc` | `.claude/rules/api-patterns.md` | RTK Query + slices |
| `component-structure.mdc` | `.claude/rules/component-structure.md` | Web pages + admin components/app |
| `admin-app.mdc` | `.claude/rules/admin-app.md` + `admin/CLAUDE.md` | `admin/src/**` |
| `form-handling.mdc` | `.claude/rules/form-handling.md` | Forms in web + admin |
| `firebase-functions.mdc` | `.claude/rules/firebase-functions.md` + `functions/CLAUDE.md` | `functions/src/**` |
| `production-infra.mdc` | `.claude/rules/production-infra.md` | CI, Firebase config |
| `lab-studyforge.mdc` | `.claude/skills/lab-to-studyforge/SKILL.md` | `docs/tasks/**/03-labs/**` |

## Shared Conventions

Both Cursor and Claude Code use:

- [`AGENTS.md`](../../AGENTS.md) — full conventions (read on demand; Cursor workspace rule)
- [`CLAUDE.md`](../../CLAUDE.md) — thin Claude always-on memory + pointers (no `@AGENTS.md` import)
- Nested `web|admin|functions|libs/shared-types/CLAUDE.md` — package memory for Claude
- [`.claude/SETUP.md`](../../.claude/SETUP.md) — Claude setup guide

## MCP

Playwright MCP is configured in [`.mcp.json`](../../.mcp.json) for Claude Code. Cursor may mirror servers in [`.cursor/mcp.json`](../mcp.json).

## Agents (Claude Code)

| Agent | Role |
|-------|------|
| `web-page-scaffolder` | Page → Provider → Container scaffolding |
| `functions-reviewer` | Read-only functions/backend review |
| `verify-changes` | Adversarial `/check` before done |

## Validation

Before reporting done:

```bash
NX_DAEMON=false NX_ISOLATE_PLUGINS=false yarn nx run web:typecheck
NX_DAEMON=false NX_ISOLATE_PLUGINS=false yarn nx run web:lint
```

For admin changes: `admin:typecheck`, `admin:lint`. For functions: `functions:lint`, `functions:build`.
