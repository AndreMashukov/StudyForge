# Claude Code Setup — StudyForge

How this repo is configured for Claude Code, and how it stays aligned with Cursor.

## Layout

```
CLAUDE.md                 # Thin always-on memory (do not @-import AGENTS.md)
CLAUDE.local.md           # Optional personal overrides (gitignored)
web|admin|functions/CLAUDE.md
libs/shared-types/CLAUDE.md
AGENTS.md                 # Full conventions — read on demand
.claude/
├── settings.json         # Permissions, hooks, MCP allowlist
├── hooks/                # block-dangerous-bash, block-secrets, format-on-write, remind-check
├── rules/                # Path-scoped MUST/NEVER rules
├── skills/               # /check, /format, page-pattern, worktrees, …
├── agents/               # web-page-scaffolder, functions-reviewer, verify-changes
└── SETUP.md              # This file
.mcp.json                 # Project MCP servers (Playwright)
.cursor/rules/            # Cursor mirrors of .claude/rules
```

## Memory strategy

| Layer | When loaded | Purpose |
|-------|-------------|---------|
| Root `CLAUDE.md` | Every session | Commands, gotchas, pointers |
| Nested `*/CLAUDE.md` | When working in that tree | Package-specific conventions |
| `.claude/rules/*.md` with `paths:` | When matching files are read | MUST/NEVER enforcement |
| Skills / agents | On invoke or proactive match | Multi-step workflows |
| `AGENTS.md` | Only when you Read it | Full handbook — keep out of always-on context |

Verify with `/context` and `/memory`. Run `/doctor` after large CLAUDE.md edits.

## Permissions

- **Allow**: common NX typecheck/lint/dev/build, `gh pr`, git worktree, prettier
- **Deny**: hosting deploy, `web:deploy`, force-push, destructive `rm -rf` of home/root
- Hooks reinforce deny for Bash + secret writes

## Hooks

| Event | Script | Behavior |
|-------|--------|----------|
| PreToolUse Bash | `block-dangerous-bash.sh` | Deny hosting deploy / force-push / bad rm |
| PreToolUse Edit\|Write | `block-secrets.sh` | Deny secret-looking content / env files |
| PostToolUse Edit\|Write | `format-on-write.sh` | Prettier on `web|admin|functions|libs` |
| Stop | `remind-check-on-stop.sh` | One reminder to `/check` when source is dirty |

## MCP

Project `.mcp.json` enables Playwright. Claude `settings.json` sets `enableAllProjectMcpServers: false` and `enabledMcpjsonServers: ["playwright"]`. Cursor uses `.cursor/mcp.json` (may be empty locally; add the same Playwright server there if needed).

## Validation

```bash
NX_DAEMON=false NX_ISOLATE_PLUGINS=false yarn nx run web:typecheck
NX_DAEMON=false NX_ISOLATE_PLUGINS=false yarn nx run web:lint
```

Or invoke `/check`. Agent `verify-changes` is the adversarial reviewer.

## Personal config

- Initials / preferences: `~/.claude/CLAUDE.md`
- Per-repo personal notes: `CLAUDE.local.md` (gitignored)
- Local permission tweaks: `.claude/settings.local.json` (gitignored)
