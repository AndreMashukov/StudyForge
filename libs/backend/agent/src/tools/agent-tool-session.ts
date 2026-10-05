import type { AgentToolDefinition } from './create-agent-tools';

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

export interface IAgentToolSession {
  listToolCatalog(): IAgentToolCatalogEntry[];
  listOpenAiTools(): IOpenAiFunctionTool[];
  callTool(name: string, args: Record<string, unknown>): Promise<unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parametersOf(
  definition: AgentToolDefinition,
): Record<string, unknown> {
  return isRecord(definition.parameters)
    ? definition.parameters
    : { type: 'object', properties: {} };
}

export function createAgentToolSession(
  definitions: AgentToolDefinition[],
): IAgentToolSession {
  const byName = new Map(
    definitions.map((definition) => [definition.name, definition]),
  );
  const catalog: IAgentToolCatalogEntry[] = definitions.map((definition) => ({
    name: definition.name,
    description: definition.description,
  }));
  const openAiTools: IOpenAiFunctionTool[] = definitions.map((definition) => ({
    type: 'function',
    function: {
      name: definition.name,
      description: definition.description,
      parameters: parametersOf(definition),
    },
  }));

  return {
    listToolCatalog(): IAgentToolCatalogEntry[] {
      return catalog;
    },
    listOpenAiTools(): IOpenAiFunctionTool[] {
      return openAiTools;
    },
    async callTool(
      name: string,
      args: Record<string, unknown>,
    ): Promise<unknown> {
      const definition = byName.get(name);
      if (!definition) {
        throw new Error(`Unknown tool: ${name}`);
      }
      return definition.execute(isRecord(args) ? args : {});
    },
  };
}

export function isAgentToolSession(value: unknown): value is IAgentToolSession {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.listToolCatalog === 'function' &&
    typeof value.listOpenAiTools === 'function' &&
    typeof value.callTool === 'function'
  );
}
