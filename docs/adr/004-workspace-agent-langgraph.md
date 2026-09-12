# ADR 004: Workspace agent LangGraph migration

## Status

Accepted

## Context

The workspace and directory-scoped AgentPanel used Google ADK runners (`AgentAdkPlanExecuteRunner`, `AgentAdkRunner`) with plan-execute semantics: a planner emits JSON plans or final replies, an executor runs one natural-language step per iteration with tools, and replanning continues until a final answer.

Directory chat already uses a one-shot LangGraph pipeline without a checkpointer. Artifact generation uses kind-specific LangGraph graphs, also without checkpointers, because each job is a single Cloud Task invocation.

The workspace agent is different: it runs inside a 300s Firebase Function HTTP request with live SSE status and token deltas. Users may lose the connection when the Function times out or the instance dies mid-turn.

## Decision

1. Replace ADK AgentPanel runners with one plan-execute LangGraph graph for both `scope: workspace` and `scope: directory`. Directory chat stays on its existing graph.

2. Persist mid-turn graph state in Firestore via a `BaseCheckpointSaver` adapter under `users/{userId}/agentCheckpoints/{turnKey}/`. LangGraph `thread_id` is `${studyForgeThreadId}:${turnId}`, not the StudyForge conversation id alone.

3. Resume after failure via a second HTTP/SSE request with `resume: true` and the same `turnId`. Do not use Cloud Tasks for workspace agent turns.

4. Stream real token deltas only for the final planner reply through `@study-forge/backend-llm` `onDelta`. The planner completion still returns JSON; only decoded characters of the `response` field are forwarded as SSE `delta` events, and only after `"type":"response"` is known. Plan JSON, parse retries, and ungrounded create replies are not streamed. Planning and executor steps emit status SSE events only. Do not use LangGraph `astreamEvents`.

5. Do not migrate historical ADK sessions into checkpoints. Durable chat history remains on StudyForge agent threads.

6. Write `expiresAt` on checkpoint docs with a 7-day TTL category (`agentCheckpoint`). Enable the Firebase TTL policy on that field in ops.

7. Remove `libs/backend/agent/src/adk/`. Google ADK remains in use for document generation pipelines under `libs/backend/documents/`.

## Consequences

- AgentPanel resume requires a small web change (`turnId`, `resume`, one client retry).
- Checkpoint storage adds Firestore writes per graph superstep; TTL bounds cost.
- One compiled graph per process with a shared Firestore checkpointer that reads `userId` from `configurable`.
- Rollback is revert plus Functions deploy; no ADK fallback flag in this migration.
