# ADR 002: Client-side library reads and mutations

## Status

Accepted (2026-08-27)

## Context

Most library data lived in Firestore, but the web app routed reads and CRUD mutations through Cloud Functions callables. That added latency, duplicated logic between callables and Firestore, and made realtime listeners harder to use consistently.

Generation (LLM work, usage billing, job enqueue) must stay server-side for secrets, quotas, and Admin SDK access.

## Decision

1. **Client-owned paths**: The signed-in user reads and mutates their library through the Firestore and Storage SDKs in `web/src/services/`. RTK Query endpoints use `queryFn` with those services. No callable fallback for these paths.

2. **Generation-owned creates**: Creating documents and artifacts (including ingest and prompt/screenshot flows) stays on Cloud Functions. Clients cannot create quiz/document/artifact records or write `generationStatus`, usage, or billing fields (enforced in `firestore.rules`).

3. **Directory items index**: The client updates `directories/{id}/items/{itemId}` in the same batch as canonical writes. Generation jobs continue updating the index via Admin SDK.

4. **Deletes and storage**: The client deletes Firestore records, index rows, and Storage files (document HTML, slide images). It does not write `usageSummary`; storage quota may stay high until a server refresh.

5. **Server-only surfaces**: Generation callables, Stripe billing, API-key create/revoke, usage writes, External API, and `processGenerationJob` remain on Cloud Functions.

6. **Cutover**: Deploy expanded Firestore and Storage rules before the web build that writes from the client. Remove unused CRUD callables in the same release window.

## Consequences

- Lower latency for library reads and edits; simpler realtime sync.
- Security rules must block forged artifacts and generation field tampering.
- Backend CRUD callable endpoints are removed from `functions/src/index.ts`; backend libs remain for generation and External API.
- Usage meter may drift after client deletes until `refreshUsageSummary` runs.
