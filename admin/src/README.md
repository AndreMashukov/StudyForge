# `admin/src` — organization

Purpose folders replace a catch-all `lib/`. Routing stays in `app/`; shared UI in `components/`.

```text
src/
├── app/                 # App Router only
├── components/          # Reusable UI by domain
├── hooks/               # Client React hooks
├── providers/           # Client providers (Zustand store context)
├── stores/              # Zustand store factory + slices (client UI state)
├── data/                # Server-only DAL (import 'server-only')
├── mutations/           # Browser → Next Route Handler helpers
├── firebase/            # Firebase Admin + browser clients
├── auth/                # Session cookie + admin claim verification
├── security/            # Encryption and other server secrets helpers
├── utils/               # Tiny pure helpers (cn)
└── domain/              # Pure domain logic (no I/O)
    └── provider-connections/
```

## Placement rule

| If the code… | Put it in… |
|---|---|
| Queries Firestore / Auth on the server | `data/` |
| Calls Route Handlers from the browser | `mutations/` |
| Creates a Firebase client | `firebase/` |
| Verifies admin session cookies | `auth/` |
| Encrypts provider credentials | `security/` |
| Is pure UI formatting | `utils/` |
| Encodes domain rules with no I/O | `domain/<name>/` |
| Shared client UI state (shell sidebar) | `stores/` + `providers/` |
| Is React UI | `components/<domain>/` |
| Is a route-only client | `app/(app)/…/_components/` |

## Dependency direction

```text
app → components / hooks / providers → stores | mutations | domain | utils
app → data → firebase | security | auth
app/api → data → firebase | security | auth
```

Do not import `data/` from Client Components. Do not import `mutations/` from Server Components unless you intentionally add a server path.

Zustand stores are client-only. Create them with `createUiStore()` inside `UiStoreProvider` (per-request factory). React Server Components must not read or write the store.
