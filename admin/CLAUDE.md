# admin — StudyForge

Next.js 16 App Router, RSC-first, Firebase Admin server-side, Vercel. Dev: `:4201`.

## Commands

```bash
NX_DAEMON=false NX_ISOLATE_PLUGINS=false yarn nx run admin:typecheck
NX_DAEMON=false NX_ISOLATE_PLUGINS=false yarn nx run admin:lint
NX_DAEMON=false NX_ISOLATE_PLUGINS=false yarn nx run admin:dev
NX_DAEMON=false NX_ISOLATE_PLUGINS=false yarn nx run admin:build
```

## Layout

```
admin/src/
├── app/          # App Router routes + API routes
├── components/   # Admin UI + shadcn primitives
└── lib/          # Auth, Firebase Admin, security helpers
```

## Must Follow

- Firebase Admin SDK **server-side only** for privileged Firestore reads
- Session cookie auth (`admin_session` by default)
- Require Firebase custom claim `{"role": "admin"}`
- shadcn/ui from `admin/src/components/ui/` — never MUI
- Never `cd admin/` for build/lint — NX from workspace root

## Env

- `admin/.env.local` — `NEXT_PUBLIC_*` for browser; server secrets without prefix
- Copy from `admin/.env.example`

## Reference

- Path rule: `.claude/rules/admin-app.md`
- Full conventions: `AGENTS.md` (read on demand)
