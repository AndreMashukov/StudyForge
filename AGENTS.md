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

# Worktree Playbook

- Always verify active worktrees before doing any setup or task execution: `git worktree list`
- Always execute commands from the target worktree root: `/Users/andreymashukov/.codex/worktrees/<id>/code-insights-ai`
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
