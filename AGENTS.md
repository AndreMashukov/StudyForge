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
- `functions/.env` — `GEMINI_API_KEY`, `FIREBASE_PROJECT_ID`. Copy from `functions/.env.example`.

### Firebase Emulators

The app requires Firebase emulators for local development (Auth:9099, Firestore:8080, Functions:5001, Storage:9199, Hosting:5002). Start them with:

```bash
yarn firebase emulators:start --project demo-project
```

Or via NX: `yarn nx run functions:serve` (builds functions first, then starts emulators).

Java (JDK 21+) is required for the Firestore emulator — it is pre-installed in the Cloud VM.

### User initialization for login

Firebase Auth emulator starts empty. To log in to the web app, you must first create a user in the Auth emulator:

```bash
curl -s -X POST 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-api-key' \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@example.com","password":"Test1234!","returnSecureToken":true}'
```

Alternatively, use the Firebase Emulator UI at `http://localhost:4000` to create users, or restore a backup.

### Web dev server

```bash
yarn nx run web:dev
```

Starts on `http://localhost:4200`. Requires the `.env` file with Firebase config (uses `NX_PUBLIC_` prefix for Vite).

### Known warnings

- `web:lint` produces 1 pre-existing warning in `RuleSelector.tsx` (accessible-emoji).
- `web:build` shows a PostCSS `@import` order warning in `styles.css` — cosmetic, does not block the build.
- Documents page shows "Error loading content" when no documents exist in Firestore — this is expected empty-state behavior, not a bug.
