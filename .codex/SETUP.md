# Codex setup — StudyForge

Codex reads the root `AGENTS.md` and the nested `AGENTS.md` files for the directory being worked on. These point to the same package guidance and path rules used by Claude and Cursor. Keep those shared files aligned when conventions change.

Project skills are discoverable under `.agents/skills/`. The three LangSmith skills already live there; the other entries point to their corresponding `.claude/skills/` workflows so updates have one source of truth. Invoke a skill by name (for example, `$check` or `$page-pattern`). `grill-with-docs` remains explicit-only.

The project `.codex/config.toml` configures the same Playwright MCP server as `.mcp.json`. Project configuration requires a trusted workspace; MCP availability also depends on the Codex client and installed dependencies. Restart a session after adding skills or changing configuration if they are not yet visible.

Claude's `.claude/settings.json` permissions and hooks do not automatically apply to Codex. In particular, its command and secret blockers, format-on-write hook, and stop reminder are not installed by this setup. Follow the repository instructions, validate changes with Nx, and configure any desired enforcement separately for the Codex environment. Claude's specialized agent definitions remain reference material in `.claude/agents/`; this setup does not automatically create or launch Codex subagents.

Cursor's prompts remain in `.cursor/prompt/`; the `interactive-html` skill covers its corresponding workflow. The existing root and nested guidance plus shared rules provide the equivalent project conventions.
