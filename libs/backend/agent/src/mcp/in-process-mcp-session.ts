import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { fromJSONSchema } from 'zod/v4';
import type { AgentToolDefinition } from '../tools/create-agent-tools';

export interface IAgentToolCatalogEntry {
  name: string;
  description: string;
}

export interface IOpenAiFunctionTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface IInProcessMcpSession {
  listToolCatalog(): IAgentToolCatalogEntry[];
  listOpenAiTools(): IOpenAiFunctionTool[];
  callTool(name: string, args: Record<string, unknown>): Promise<unknown>;
  close(): Promise<void>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isTextContentBlock(
  value: unknown,
): value is { type: 'text'; text: string } {
  return isRecord(value) && value.type === 'text' && typeof value.text === 'string';
}

function readToolTextContent(content: unknown): string {
  if (!Array.isArray(content) || content.length === 0) {
    return '';
  }
  const first = content[0];
  if (isTextContentBlock(first)) {
    return first.text;
  }
  return '';
}

function serializeToolResult(result: unknown): string {
  const serialized = JSON.stringify(result);
  return typeof serialized === 'string' ? serialized : 'null';
}

function toolArgsFromMcp(args: unknown): Record<string, unknown> {
  return isRecord(args) ? args : {};
}

function parametersToInputSchema(
  parameters: Record<string, unknown>,
): ReturnType<typeof fromJSONSchema> {
  return fromJSONSchema(parameters);
}

function registerAgentTools(server: McpServer, definitions: AgentToolDefinition[]): void {
  for (const definition of definitions) {
    server.registerTool(
      definition.name,
      {
        description: definition.description,
        inputSchema: parametersToInputSchema(definition.parameters),
      },
      async (args) => {
        try {
          const result = await definition.execute(toolArgsFromMcp(args));
          return {
            content: [{ type: 'text', text: serializeToolResult(result) }],
          };
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Tool execution failed';
          return {
            content: [{ type: 'text', text: message }],
            isError: true,
          };
        }
      },
    );
  }
}

function toOpenAiFunctionTool(tool: {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}): IOpenAiFunctionTool {
  const parameters = isRecord(tool.inputSchema)
    ? tool.inputSchema
    : { type: 'object', properties: {} };

  return {
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description ?? '',
      parameters,
    },
  };
}

class InProcessMcpSession implements IInProcessMcpSession {
  private readonly client: Client;
  private readonly server: McpServer;
  private readonly catalog: IAgentToolCatalogEntry[];
  private readonly openAiTools: IOpenAiFunctionTool[];
  private closed = false;

  private constructor(
    client: Client,
    server: McpServer,
    catalog: IAgentToolCatalogEntry[],
    openAiTools: IOpenAiFunctionTool[],
  ) {
    this.client = client;
    this.server = server;
    this.catalog = catalog;
    this.openAiTools = openAiTools;
  }

  static async create(
    definitions: AgentToolDefinition[],
  ): Promise<InProcessMcpSession> {
    const server = new McpServer(
      { name: 'studyforge-workspace-agent', version: '1.0.0' },
      { capabilities: { tools: {} } },
    );
    registerAgentTools(server, definitions);

    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);

    const client = new Client(
      { name: 'studyforge-workspace-agent-executor', version: '1.0.0' },
      { capabilities: {} },
    );
    await client.connect(clientTransport);

    const listed = await client.listTools();
    const catalog = listed.tools.map((tool) => ({
      name: tool.name,
      description: tool.description ?? '',
    }));
    const openAiTools = listed.tools.map((tool) =>
      toOpenAiFunctionTool({
        name: tool.name,
        description: tool.description,
        inputSchema: isRecord(tool.inputSchema) ? tool.inputSchema : undefined,
      }),
    );

    return new InProcessMcpSession(client, server, catalog, openAiTools);
  }

  listToolCatalog(): IAgentToolCatalogEntry[] {
    return this.catalog;
  }

  listOpenAiTools(): IOpenAiFunctionTool[] {
    return this.openAiTools;
  }

  async callTool(
    name: string,
    args: Record<string, unknown>,
  ): Promise<unknown> {
    if (this.closed) {
      throw new Error('In-process MCP session is closed');
    }

    const result = await this.client.callTool({
      name,
      arguments: args,
    });

    const text = readToolTextContent(result.content);

    if (result.isError) {
      throw new Error(text || 'Tool execution failed');
    }

    if (text.length === 0) {
      return null;
    }

    try {
      const parsed: unknown = JSON.parse(text);
      return parsed;
    } catch {
      return text;
    }
  }

  async close(): Promise<void> {
    if (this.closed) {
      return;
    }
    this.closed = true;
    await this.client.close();
    await this.server.close();
  }
}

export async function createInProcessMcpSession(
  definitions: AgentToolDefinition[],
): Promise<IInProcessMcpSession> {
  return InProcessMcpSession.create(definitions);
}

export function isInProcessMcpSession(value: unknown): value is IInProcessMcpSession {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.listToolCatalog === 'function' &&
    typeof value.listOpenAiTools === 'function' &&
    typeof value.callTool === 'function' &&
    typeof value.close === 'function'
  );
}
