---
name: worktree-create
description: Create a git worktree for parallel development in this NX monorepo
effort: high
allowed-tools: Bash
argument-hint: <type/description/initials>
---

# Worktree Create

## Task

Create a git worktree based on `$ARGUMENTS` (e.g., `feat/add-quiz-filter/am`).

### Pre-flight

```bash
git fetch origin main
git worktree list
```

### Branch Mode (`<type>/<description>/<initials>`)

1. Parse input into `type`, `description`, `initials`
2. **Directory**: `../StudyForge-<description>-<initials>` (sibling to main worktree)
3. **Branch**: `<type>/<description>/<initials>`
4. **Create worktree**:
   ```bash
   git worktree add -b <type>/<description>/<initials> <path> origin/main
   ```
5. **Setup**:
   ```bash
   cd <path> && ./scripts/setup-worktree.sh
   ```
6. **Copy env files** from main worktree (gitignored):
   ```bash
   MAIN_DIR=$(git worktree list | head -1 | awk '{print $1}')
   cp "$MAIN_DIR/.env" "<path>/.env" 2>/dev/null || true
   cp "$MAIN_DIR/web/.env" "<path>/web/.env" 2>/dev/null || true
   cp "$MAIN_DIR/admin/.env.local" "<path>/admin/.env.local" 2>/dev/null || true
   cp "$MAIN_DIR/functions/.env" "<path>/functions/.env" 2>/dev/null || true
   cp "$MAIN_DIR/functions/.env.local" "<path>/functions/.env.local" 2>/dev/null || true
   ```
7. **Report**: full path, branch name, setup status

### Verify Readiness

```bash
test -f node_modules/nx/package.json && ./node_modules/.bin/nx --version
```
