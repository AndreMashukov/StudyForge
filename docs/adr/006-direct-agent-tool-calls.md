# ADR 006: Direct tool calls for the workspace agent

## Status

Accepted. Supersedes [ADR 005](./005-in-process-mcp-agent-tools.md).

## Context

ADR 005 routed every workspace-agent turn through an in-process MCP server so the same catalog could later be exposed as an external MCP server. The model already received OpenAI function tools from `callToolChatCompletions`. MCP only sat between `AgentChatRunner` and `AgentToolDefinition.execute()`.

That hop converted each result to MCP text content and parsed it back, and it converted JSON Schema through Zod on every turn. LangChain and LangGraph expect in-process tools to be called directly. MCP is the boundary for tools that live in another process.

## Decision

1. Keep `createAgentToolDefinitions()` as the source of truth for tool names, descriptions, JSON Schema parameters, and `execute()` bodies.

2. At the start of each `WorkspaceAgentRunner.run` turn, build one `IAgentToolSession` with `createAgentToolSession()`. Pass it on LangGraph `configurable.toolSession` for the planner catalog and every executor `AgentChatRunner` loop. The session is not closed: it holds no transport.

3. `listOpenAiTools()` copies each definition's JSON Schema into the OpenAI function tool shape. `callTool()` calls `execute()` and returns that value. Do not use LangChain `ToolNode` or `DynamicStructuredTool` on this path. Provider routing and streaming stay in `callToolChatCompletions`.

4. Do not register an in-process `McpServer` for the live agent. An external MCP server, if added later, should register the same definitions at that boundary.

## Consequences

- Tool results are no longer JSON-serialized and parsed before they reach the runner. `AgentChatRunner` still serializes the result for the tool message sent back to the model.
- Resume after checkpoint still builds a fresh session with newly built tool closures.
- `@modelcontextprotocol/sdk` is no longer a dependency of the agent library.
