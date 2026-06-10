---
name: check
description: Run typecheck and lint without modifying files. Use when validating changes, before commits, or when the user asks to check code quality.
allowed-tools: Bash
effort: high
argument-hint: [project or path]
---

# Check Skill

## Usage

- `/check` — typecheck + lint web, admin, and functions (matches CI scope)
- `/check web` — web project only
- `/check admin` — admin project only
- `/check functions` — functions project only

## Instructions

When invoked, always use NX with daemon/plugin isolation disabled:

```bash
NX_DAEMON=false NX_ISOLATE_PLUGINS=false
```

1. **TypeScript type check** (always run first):
   - `web`: `yarn nx run web:typecheck`
   - `admin`: `yarn nx run admin:typecheck`
   - `functions`: `yarn nx run functions:build` (no dedicated typecheck target)
   - No argument: run `web:typecheck` then `admin:typecheck`

2. **ESLint:**
   - With `web` argument: `yarn nx run web:lint`
   - With `admin` argument: `yarn nx run admin:lint`
   - With `functions` argument: `yarn nx run functions:lint`
   - Without arguments: `web:lint`, `admin:lint`, then `functions:lint`

3. **Report results:**
   - All pass → confirm ready for commit/PR
   - Failures → list errors with file paths; stop on first failure when running full suite

## CI Parity

Production deploy workflow also runs `web:build`. For PR-ready validation:

```bash
NX_DAEMON=false NX_ISOLATE_PLUGINS=false yarn nx run web:build
```

## Known Pre-Existing Warnings

- `RuleSelector.tsx` accessible-emoji warning — do not flag as new
