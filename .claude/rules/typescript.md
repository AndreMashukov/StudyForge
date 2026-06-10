---
description: TypeScript type safety — no assertions, strict typing
paths:
  - "**/*.ts"
  - "**/*.tsx"
---

# TypeScript — StudyForge

## MUST Follow

1. **MUST use interfaces** for props and data structures (prefix with `I`).
2. **MUST use type guards** instead of type assertions when narrowing unknown values.
3. **MUST use `z.infer<typeof schema>`** for form and API payload types derived from Zod.
4. **MUST import shared types** from `@shared-types` for cross-boundary contracts (web ↔ functions).
5. **MUST prefix unused variables** with underscore (`_error`, `_result`).

## NEVER Do

- NEVER: `as any`, `as unknown`, `as Record<string, unknown>`
- NEVER: `@ts-ignore`, `@ts-expect-error`
- NEVER create duplicate types — check `web/src/types/` and `libs/shared-types/` first
- NEVER use empty interfaces — use `Record<string, never>` or omit props

## Project-Specific Allowances

Third-party boundaries may require narrow escapes. If unavoidable, use a single-line disable with a reason:

```typescript
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Firebase callable response boundary
```

Prefer fixing the actual type over adding disables.

## Reference

- [AGENTS.md](../../AGENTS.md) — TypeScript and coding conventions
