---
name: styling-system
description: shadcn/ui component usage, Tailwind design tokens, and icon conventions for StudyForge
---

# Styling System

## Stack

- shadcn/ui primitives in `web/src/components/ui/` and `admin/src/components/ui/`
- Tailwind CSS 3 with tokens in `web/src/styles.css` and `admin/src/app/globals.css`
- Lucide React icons
- `cn()` from `web/src/lib/utils.ts`

## Design Tokens

```css
--background: 0 0 0;
--foreground: 255 255 255;
--card: 17 17 17;
--primary: 139 92 246;      /* purple */
--accent: 34 197 94;        /* green */
--muted: 39 39 42;
--destructive: 239 68 68;
--border: 39 39 42;
--radius: 0.75rem;
```

Usage: `bg-primary`, `text-muted-foreground`, `border-border`, `rounded-lg`

## Component Imports

```typescript
import { Button } from '../ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Dialog, DialogContent, DialogFooter } from '../ui/dialog';
import { FileText } from 'lucide-react';
import { cn } from '../../lib/utils';
```

## Button Variants

`default` | `destructive` | `outline` | `secondary` | `ghost` | `link`

Sizes: `default` | `sm` | `lg` | `icon`

## Rules

- No MUI — ever
- No arbitrary hex when a token exists
- No inline SVG when Lucide has the icon
- Use `cn()` for conditional classes

## Reference

- `.claude/rules/styling.md`
- [docs/architecture/components-layer.md](../../docs/architecture/components-layer.md)
