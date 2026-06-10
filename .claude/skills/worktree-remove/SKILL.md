---
name: worktree-remove
description: Safely remove a git worktree after work is merged
effort: high
allowed-tools: Bash
argument-hint: <worktree-path>
---

# Worktree Remove

## Task

Remove worktree at `$ARGUMENTS`.

### Safety checks

1. Confirm the worktree path exists: `git worktree list`
2. Confirm branch work is integrated on `main`:
   ```bash
   git merge-base --is-ancestor <branch> main || [ -z "$(git diff main...<branch>)" ]
   ```
3. If not integrated, **refuse** and report — do not force-remove.

### Remove

```bash
git worktree remove <path>
git branch -D <branch>   # only if integrated
```

### Verify

```bash
git worktree list
```
