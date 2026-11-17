# client-data

Client-side Firestore paths, learning telemetry writes, and Statistics reads shared by `web` and `mobile-capture` ([ADR 007](../../docs/adr/007-shared-client-data-library.md)).

Call `configureClientData({ db })` once at app start before using anything else. Mobile also passes `sha256Hex` (React Native has no `crypto.subtle`). The library never imports app Firebase config, React, or Redux.
