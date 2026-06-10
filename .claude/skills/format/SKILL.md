---
name: format
description: Format staged source files with Prettier. Use before commits or when formatting issues are reported.
allowed-tools: Bash
effort: high
argument-hint: [file or path]
---

# Format Skill

## Usage

- `/format` — format staged `.ts`, `.tsx`, `.css`, `.json` files under `web/`, `admin/`, `functions/`, and `libs/`
- `/format <path>` — format specified file(s) or directory

## Instructions

When invoked:

1. **With arguments:** Run Prettier on the specified path(s):
   ```bash
   yarn prettier --write <path>
   ```

2. **Without arguments:** Format staged files:
   ```bash
   git diff --cached --name-only --diff-filter=ACMR | grep -E '^(web|admin|functions|libs)/.*\.(ts|tsx|css|json|md)$'
   ```
   - If no matching staged files, inform the user
   - Otherwise: `yarn prettier --write <files>`

3. **ESLint auto-fix** on staged TS/TSX (optional, after Prettier):
   ```bash
   yarn nx run web:lint --fix
   ```

4. Report which files were formatted.
