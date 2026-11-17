# ADR 007: Shared client data library for web and mobile

## Status

Accepted (2026-11-16)

## Context

ADR 002 moved library reads and learning telemetry writes (quiz attempts, flashcard study sessions, stats rollups, TTLs) to the client Firestore SDK, implemented in `web/src/services/`. The mobile app (`mobile-capture`) is gaining native flashcard and quiz players and must write the same records, or Statistics will disagree between platforms. Both clients use the modular `firebase/firestore` SDK.

## Decision

Extract the client-owned Firestore paths, learning telemetry mutations and statistics reads from `web/src/services/` into a new NX library, `libs/client-data`, imported by both `web` and `mobile-capture`. Each app calls `configureClientData({ db, sha256Hex? })` once at start; the library imports no app-specific config, React, or Redux. Web keeps its `web/src/services/*` module paths as thin re-exports, so existing call sites and test mocks are unchanged. The client-path rules from ADR 002 apply unchanged.

## Considered Options

- **Mobile calls the legacy `recordQuizAttempt` callable**: rejected. It goes against ADR 002's client-path direction, may lag behind the web implementation, and has no flashcard-session counterpart.
- **Copy the mutations into mobile**: rejected. Two copies of the rollup and TTL logic would drift, and Statistics would silently disagree.

## Consequences

- Changes to telemetry shape are made once and tested once. Both apps pick them up together.
- `libs/client-data` must stay platform-neutral: no DOM, React Native, or web-only Firebase config imports.
- Mobile wraps these writes in an offline outbox. The library itself assumes it is online.
- The library also holds the other client paths both apps need: directory creation and the directory-item index writer, agent thread reads, and the agent SSE parser. Web's delete and move mutations stay in `web/src/services` for now because their read helpers depend on the web Redux cache; moving them means first separating those helpers from Redux.
