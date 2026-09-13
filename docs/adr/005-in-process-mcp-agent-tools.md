# ADR 005: In-process MCP tool dispatch for workspace agent

## Status

Accepted

## Context

The workspace and directory-scoped agents expose tools through `AgentToolDefinition[]` in [`create-agent-tools.ts`](../../libs/backend/agent/src/tools/create-agent-tools.ts). The executor runs `AgentChatRunner`, which maps those definitions to OpenAI-shaped tools and calls `execute()` directly. `@modelcontextprotocol/sdk` is already pinned in the monorepo but unused.

We want to dogfood MCP before exposing an external MCP server: the same tool catalog should be registered on an in-process `McpServer` and consumed through a `Client` over `InMemoryTransport` in the same Node process.

## Decision

1. Keep `createAgentToolDefinitions()` as the source of truth for tool names, descriptions, JSON Schema parameters, and `execute()` bodies. Only dispatch wiring changes.

2. At the start of each `WorkspaceAgentRunner.run` turn, build one in-process MCP session: register the turn's definitions on `McpServer`, connect a `Client` via `InMemoryTransport.createLinkedPair()`, and pass the session on LangGraph `configurable` for the whole graph invoke (planner catalog and every executor `AgentChatRunner` loop). Close the session in `finally`.

3. The live path lists tools via `client.listTools()` and executes via `client.callTool()`. Map `listTools` JSON Schema to the existing OpenAI tool shape for LLM calls. Do not use LangChain `ToolNode`, `DynamicStructuredTool`, or a JSON Schema to Zod bridge for the LLM path. Use `zod/v4` `fromJSONSchema` only when registering tools on `McpServer`.

4. Tool names stay snake_case (`create_document`, etc.). No dotted renames.

5. No elicitation, no new SSE interrupt events, and no changes to checkpoint resume semantics in this ADR. Existing `AgentMessageRequest.resume` continues to mean "continue a dead Function from a workspace agent checkpoint."

## Considered options

- **Registry only:** expose `McpServer` for tests and external use but keep `execute()` in `AgentChatRunner`. Rejected because it does not dogfood the Client path the external server will rely on.
- **Process-wide `McpServer`:** rejected because tools close over per-turn `AgentToolRuntimeContext` (user, scope, directory IDs, action buffers).
- **Full spec bridge (Zod converter + elicitation + ToolNode):** rejected for v1; elicitation and stream interrupt wiring are a follow-up.

## Consequences

- Each agent turn pays MCP connect/list/close overhead inside the Function. Acceptable for v1 plumbing; external transport can reuse the same registration code later.
- Resume after checkpoint opens a fresh MCP session with newly built tool closures, matching today's per-turn tool context.
- Unit tests can assert `listTools` and `callTool` over `InMemoryTransport` without network or auth.
