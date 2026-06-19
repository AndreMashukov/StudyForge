# Cursor Rules — StudyForge

Path-scoped rules that mirror [`.claude/rules/`](../../.claude/rules/) for Cursor IDE parity with Claude Code.

## Rule Map

| Cursor rule | Claude equivalent | Scope |
|-------------|-------------------|-------|
| `studyforge-core.mdc` | `CLAUDE.md` (summary) | Always apply |
| `typescript.mdc` | `.claude/rules/typescript.md` | All `.ts`/`.tsx` |
| `styling.mdc` | `.claude/rules/styling.md` | `web/src/**`, `admin/src/**` |
| `api-patterns.mdc` | `.claude/rules/api-patterns.md` | RTK Query + slices |
| `component-structure.mdc` | `.claude/rules/component-structure.md` | Web components + pages |
| `admin-app.mdc` | (admin section in `CLAUDE.md`) | `admin/src/**` |
| `form-handling.mdc` | `.claude/rules/form-handling.md` | Forms in web + admin |
| `firebase-functions.mdc` | `.claude/rules/firebase-functions.md` | `functions/src/**` |
| `production-infra.mdc` | `.claude/rules/production-infra.md` | CI, Firebase config |

## Shared Conventions

Both Cursor and Claude Code use:

- [`AGENTS.md`](../../AGENTS.md) — full conventions (workspace rule in Cursor)
- [`CLAUDE.md`](../../CLAUDE.md) — imports AGENTS.md + Claude-specific config (rules, skills, hooks); Cursor summary in `studyforge-core.mdc`

## MCP

Playwright MCP is configured in [`.cursor/mcp.json`](../mcp.json), matching Claude Code's `settings.json`.

## Validation

Before reporting done:

```bash
NX_DAEMON=false NX_ISOLATE_PLUGINS=false yarn nx run web:typecheck
NX_DAEMON=false NX_ISOLATE_PLUGINS=false yarn nx run web:lint
```

For admin changes: `admin:typecheck`, `admin:lint`. For functions: `functions:lint`, `functions:build`.

See [`docs/tasks/15-claude-code/15-claude-setup.md`](../../docs/tasks/15-claude-code/15-claude-setup.md) for the full setup guide.
