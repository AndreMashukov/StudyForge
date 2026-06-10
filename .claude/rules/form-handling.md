---
description: React Hook Form + Zod validation patterns
paths:
  - "web/src/pages/**/*.tsx"
  - "web/src/components/**/Form*.tsx"
---

# Form Handling

## Approach

- **Simple inputs**: `useState` for controlled fields
- **Complex forms**: React Hook Form + Zod; always name the form instance `form`

## MUST Follow

1. **MUST name the form instance `form`** when using React Hook Form.
2. **MUST use `zodResolver`** for schema-driven validation.
3. **MUST check existing Zod schemas** before creating new ones.
4. **MUST use shadcn Form components**: `Form`, `FormField`, `FormItem`, `FormLabel`, `FormMessage`.
5. **MUST trigger mutations in handler hooks** after validation passes.

## Schema Pattern

```typescript
import { z } from 'zod';

export const createDocumentSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  content: z.string().min(1, 'Content is required'),
});

export type CreateDocumentFormData = z.infer<typeof createDocumentSchema>;
```

## NEVER Do

- NEVER bypass validation with type assertions on form data
- NEVER put form submission side effects in `useEffect` — use handler hooks

## Reference

- [AGENTS.md](../../AGENTS.md) — Form Handling section
