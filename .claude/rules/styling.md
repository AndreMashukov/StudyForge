---
description: Styling — shadcn/ui, Tailwind CSS 3, design tokens
paths:
  - "web/src/**/*.tsx"
  - "web/src/styles.css"
  - "admin/src/**/*.tsx"
  - "admin/src/app/globals.css"
---

# Styling Rules

## MUST Follow

1. **MUST use shadcn/ui** primitives from `web/src/components/ui/` or `admin/src/components/ui/` for all UI.
2. **MUST use Lucide React** for icons — no inline `<svg>` when a Lucide icon exists.
3. **MUST use `cn()`** from `web/src/lib/utils.ts` for conditional class composition.
4. **MUST use design tokens** from `web/src/styles.css` (`bg-primary`, `text-muted-foreground`, `border-border`).
5. **MUST write accessible markup** with proper ARIA labels on interactive elements.

## NEVER Do

- NEVER use MUI — this project has no MUI dependency
- NEVER use arbitrary hex colors when a token exists (`text-[#8b5cf6]` → `text-primary`)
- NEVER use inline `<svg>` when Lucide has an equivalent icon
- NEVER create one-off UI primitives when shadcn already provides them

## Button Conventions

- Primary action: `<Button>` (default variant, purple `bg-primary`)
- Secondary/dismiss: `variant="outline"`
- Destructive: `variant="destructive"` — only for irreversible actions
- Icon buttons: `size="icon"` with Lucide icon child

## Reference

- `skills/styling-system` — token reference and component usage
- [AGENTS.md](../../AGENTS.md) — UI components and design tokens
