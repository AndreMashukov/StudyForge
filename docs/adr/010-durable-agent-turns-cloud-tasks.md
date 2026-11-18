# ADR 010: Agent turns run in a Cloud Task and survive the client closing

## Status

Accepted (2026-11-18). Supersedes ADR 004 §3; amends ADR 004 §4.

## Context

The workspace and directory-scoped agent ran inside the `agentMessageStream` HTTP request and streamed SSE to the client. When the client went away, the turn died with it:

- **Web:** collapsing the AgentPanel (it unmounts), changing page (the launcher closes the panel) or closing the tab aborted the fetch.
- **Mobile:** leaving the chat screen aborted it, and backgrounding the app kills the socket.

The server then aborted the graph and saved a generic "incomplete" reply. The partial reply was lost, the rest of the plan never ran, and because the abort path also claimed the turn's completion on the checkpoint, a later `resume` returned that placeholder. The 300s request limit also capped every turn.

## Decision

1. **The turn runs in `runAgentTurnTask`** (`onTaskDispatched`, 540s timeout, 480s soft deadline), never in a client request. Clients start it with the `startAgentTurn` callable and stop it with `cancelAgentTurn`.
2. **The agent turn doc is the single authority**: `users/{uid}/agentThreads/{threadId}/turns/{turnId}`. The worker mirrors progress into it (status line, reply so far, actions, cards), throttled and serialized, at about one write per second. One finalize transaction then writes the terminal state, the thread's one assistant message for the turn (`assistant-{turnId}`) and clears the thread's `activeTurnId`. Whoever makes that transition settles the credit reservation. The checkpoint no longer stores completions.
3. **Clients follow, they do not carry the turn.** Web (RTK `onCacheEntryAdded`) and mobile (TanStack + `onSnapshot`) listen to the turn doc and the thread doc through `libs/client-data`. Messages are refetched when the thread's `lastMessageAt` moves. Closing a client only drops the listener; reopening finds `activeTurnId` and re-attaches.
4. **Idempotent start.** Clients generate `threadId` (for a new chat) and `turnId`. Message ids are deterministic (`user-{turnId}`, `assistant-{turnId}`), and the task id is derived from the turn, so a retried start, a duplicate dispatch or a remount never double-sends. A thread has at most one active turn.
5. **Stop is explicit.** A queued or dead turn is finalized at once; a live one gets `cancelRequested`, which the worker polls every 2s and turns into an abort. The abort now reaches in-flight planner and executor LLM requests.
6. **Lease and heartbeat.** Each claim sets a fresh `leaseId`; finalize only applies with the matching lease, and a superseded worker stops itself. `sweepStaleAgentTurnsSchedule` (every 5 min) fails turns whose worker died (no heartbeat for 3 min), keeping partial work.
7. **`agentMessageStream` stays as a legacy SSE bridge** for app builds already installed: it starts the same durable turn and tails the turn doc as the old events. A disconnect only ends the tail. Remove it once its logged traffic is negligible.
8. **One attempt for now** (`MAX_AGENT_TURN_ATTEMPTS = 1`). A task retry resumes from the checkpoint, but it would replay the last superstep that was not checkpointed, so mutating tools could run twice. Raise it once mutating tool calls are idempotent across attempts.

## Considered Options

- **Keep SSE but ignore client disconnects**: rejected. Once the client goes away, Cloud Run gives no guarantee the request keeps its CPU; the 300s cap stays; there is no re-attach for a reopened client; mobile backgrounding still kills the fetch.
- **Firestore `onDocumentCreated` trigger instead of Cloud Tasks**: rejected. Event functions cap at 540s with no dedup id or dispatch rate limits, and retries are coarser.
- **Realtime Database for token streaming**: rejected. New infrastructure for a few seconds of streaming per turn; Firestore at about one write per second is enough with client-side smoothing.

## Consequences

- Reply text arrives in chunks (about one per 800ms) instead of per token; clients smooth it (`nextRevealLength`).
- An extra hop (callable, then task dispatch) adds latency at the start of a turn; the UI shows "Starting...".
- Each running turn costs about one Firestore write per second, and each open client about one read per write. Large turn fields are exempt from indexing.
- Ops: enable the TTL policy on `turns.expiresAt` and deploy the `turns (status, updatedAt)` collection-group index before the sweep runs.
- `DirectoryAgentService.streamMessage` and `claimAgentTurnCompletion` are gone; `executeAgentTurn` persists nothing and is the only execution core.
