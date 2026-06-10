---
name: worktree-status
description: Show git status across all worktrees
effort: high
allowed-tools: Bash
---

# Worktree Status

For each worktree from `git worktree list`:

1. `cd <path> && git status --short`
2. `cd <path> && git log main..HEAD --oneline | wc -l` (unmerged commits)
3. Report dirty state, branch name, and commits ahead of `main`
