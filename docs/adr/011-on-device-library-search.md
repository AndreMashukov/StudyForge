# ADR 011: Library search matches on the device over server-maintained search records

## Status

Accepted (2026-11-20).

## Context

Learners need to find directories, documents and artifacts by name, and documents by their text, as they type and with typo tolerance, on web and mobile. Firestore cannot do this itself: it has no full-text, word-prefix or fuzzy queries, and document bodies live in Cloud Storage. Libraries are private to one learner and hold hundreds of items, not millions.

## Decision

1. **Functions maintain one search record per item** (chats too since [ADR 019](019-chats-in-library-search.md)) at `users/{uid}/searchRecords/{itemType}_{sourceId}`. Eight `onDocumentWritten` triggers (directories, documents and the six artifact collections) rebuild the record from the source and write only when its content hash changes. Document records carry the body as plain text, capped at 100,000 characters. Clients never write these records.
2. **Records are built from the canonical collections**, not from `directories/{id}/items`: those rows are best-effort and drift.
3. **Devices sync records and match locally.** Web and mobile share one engine in `libs/client-data/src/librarySearch` (MiniSearch plus our tokenizer and ranking). A device pulls records changed since its cursor (`updatedAt`), keeps them in IndexedDB (web) or MMKV (mobile), and builds the index in memory at start.
4. **Deletes are tombstones** (`deleted: true`, 30-day TTL). A device that has not synced for 25 days, or that holds another schema version, syncs from scratch.
5. **Unspaced scripts** (Chinese, Japanese, Thai and similar) are indexed as overlapping character pairs and confirmed by substring, so they are findable without typo tolerance.

## Considered Options

- **Hosted search engine (Typesense Cloud, Algolia)**: best matching quality and no library-size limit, but a new vendor, a monthly bill and a sync pipeline to a second datastore, for per-learner libraries that fit on a device.
- **Matching in a Cloud Function**: nothing to download, but every keystroke is a function call, with cold starts in the typing path and no offline search.
- **Postgres full-text on the sf-support database**: reuses infrastructure but couples StudyForge to the support service, and trigram matching on long text is weaker.
- **One prebuilt index file per learner**: simpler client, but every change rebuilds and re-downloads the whole index.

## Consequences

- Search works offline once a device has synced, and costs no reads per query.
- A change appears in search after its trigger runs and the device syncs (seconds), not instantly.
- Document text exists three times: Storage, the search record, and each device. Text past the cap is not searchable.
- A device with more than 25,000,000 characters of document text indexes names, descriptions and tags only and says so. That limit and index build time on low-end phones are the signals to revisit a hosted engine; the search record collection would then be its feed.
- Items created before the triggers need `scripts/migrations/backfill-library-search-records.ts` (post-functions release phase).
- Changing how records are built or tokenized requires bumping `LIBRARY_SEARCH_SCHEMA_VERSION`, which makes every device resync.
