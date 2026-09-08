# ADR 003: Kind-specific LangGraph artifact graphs

## Status

Accepted

## Context

Diagram quiz was the first artifact kind migrated from Google ADK to LangGraph (PR #56). Flashcards follows with a repair-only loop (no critic/refiner). The original LangGraph skill assumed one shared state schema and shared nodes for all artifact kinds.

Diagram quiz and flashcards differ in loop topology, iteration limits, failure routing (flashcards short-circuits after load/generate failures), and node error handling (flashcards nodes write `artifact_outcome = 'failed'` instead of throwing).

## Decision

Each artifact kind that uses the artifact agent platform gets its own LangGraph graph, state annotation, runner, and node modules under `libs/backend/artifacts/src/artifact-agent-langgraph/<kind>/`.

Shared contracts stay centralized:

- `ARTIFACT_PIPELINE_STATE_KEYS` for durable Firestore session state channels
- `ArtifactAgentDefinition` strategy objects (generate, gates, repair, persist)
- Dispatcher in `libs/backend/generation/src/generation-processors/artifact-agent.ts`

Google ADK remains in use for workspace agents and document generation pipelines. Artifact generation no longer uses ADK after diagram quiz and flashcards cut over.

## Consequences

- Adding a new artifact kind means a new subdirectory, not extending a single mega-graph.
- Duplication of node boilerplate (logging, state key access) is accepted in exchange for kind-specific routing and failure semantics.
- The LangGraph skill and `.claude/rules/langgraph-artifact-pipeline.md` constraints still apply per graph.
