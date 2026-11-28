# ADR 019: Chats are searched in library search, set apart and budgeted after documents

## Status

Accepted (2026-11-27). Amends [ADR 011](011-on-device-library-search.md).

## Context

Learners could not find an earlier conversation with the workspace agent except by scrolling the agent history menu (newest 50) or a folder's Chats tab. Library search already matches directories, documents and artifacts on the device over server-maintained search records (ADR 011). Chats (`users/{uid}/agentThreads/{id}` with a `messages` subcollection) have no URL; the web opens one in the floating agent panel and mobile on `chat/[threadId]`.

## Decision

1. **Chats are a library search item type (`chat`)**, kept apart from `agentReferencedItemTypeSchema`: a chat is searchable but never an agent card.
2. **One search record per thread**, rebuilt by an `onDocumentWritten` trigger on the thread doc when `title`, `preview`, `homeDirectoryId` or `lastMessageAt` change. The reply message and the thread's `lastMessageAt` are written in one transaction, so the trigger always sees the committed messages and no trigger on the messages subcollection is needed. Turn bookkeeping (`activeTurnId`, `activeTurnStartedAt`) does not rebuild.
3. **Record content**: title (boosted), latest reply preview as `description`, and the user and assistant message text joined oldest first, capped at 20,000 characters keeping the newest. `directoryId` is the chat's **home folder**, so folder-scoped search finds chats started there and leaves out chats without one. `lastActivityAt` carries the latest message time.
4. **Shown apart**: the web dialog and the mobile Search screen show chats in their own Chats section after the library sections, below a divider, capped at 10, ranked by relevance with a small recency boost (up to +25%, halving every 30 days). Selecting a result opens the thread at its latest message.
5. **Device text budget**: document text gets the 25,000,000-character budget first; chat text is indexed only in what is left. Over budget, chat titles and previews are still searched and the device says so.
6. **Schema v2**: `LIBRARY_SEARCH_SCHEMA_VERSION` is bumped. Older clients skip `chat` records but still advance their sync cursor past them, so an upgraded client must resync from scratch.

## Considered Options

- **A text filter in the agent history menu**: no backend work, but it only sees the 50 loaded threads and cannot match message text.
- **Index title and preview only**: no message reads, but matches only the first message and the last reply.
- **Jump to the matched message**: needs message ids and offsets on the record and scroll-and-highlight in both chat views; deferred.
- **A shared 100,000-character cap and budget with documents**: heavy chat use could switch off document text search on a device.

## Consequences

- Every agent turn rebuilds its chat's record twice (user message, then reply), reading up to the cap's worth of messages each time.
- Text older than the newest 20,000 characters of a chat is not searchable.
- Release: deploy functions, then run `scripts/migrations/backfill-library-search-records.ts --write` so existing chats get records; clients resync on upgrade because of the schema bump (the backfill also rewrites existing records and re-reads document bodies once, since the version is part of the content hash).
