# web — StudyForge

Vite + React 19 + React Router v6 + Redux Toolkit / RTK Query. Dev: `:4200`.

## Commands

```bash
NX_DAEMON=false NX_ISOLATE_PLUGINS=false yarn nx run web:typecheck
NX_DAEMON=false NX_ISOLATE_PLUGINS=false yarn nx run web:lint
NX_DAEMON=false NX_ISOLATE_PLUGINS=false yarn nx run web:dev
NX_DAEMON=false NX_ISOLATE_PLUGINS=false yarn nx run web:build
```

## Layout

- `web/src/pages/` — feature pages (Page → Provider → Container)
- `web/src/components/` — shared UI; `ui/` is shadcn
- `web/src/store/api/` — RTK Query; `slices/` — Redux
- `web/src/types/` — web-only types (prefer `@shared-types` for contracts)

## Conventions

- Import router from `react-router-dom` (not `react-router`)
- Dates via `web/src/utils/dateUtils.ts` only
- Serializable Redux only — no Dates, Maps, Sets, class instances
- Scaffold pages with the `page-pattern` skill or `web-page-scaffolder` agent

## Reference

- Path rules: `.claude/rules/component-structure.md`, `api-patterns.md`, `styling.md`, `form-handling.md`
- Full conventions: `AGENTS.md` (read on demand)
