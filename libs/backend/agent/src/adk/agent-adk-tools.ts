import { FunctionTool } from '@google/adk';
import type { Schema } from '@google/genai';
import type { AgentToolDefinition } from '../tools/create-agent-tools';

function isGeminiSchema(value: unknown): value is Schema {
  return typeof value === 'object' && value !== null;
}

function wrapToolResult(result: unknown): Record<string, unknown> {
  if (Array.isArray(result)) {
    return { items: result };
  }
  if (typeof result === 'object' && result !== null) {
    const record: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(result)) {
      record[key] = value;
    }
    return record;
  }
  return { result };
}

export function agentToolsToFunctionTools(
  tools: AgentToolDefinition[],
): FunctionTool[] {
  return tools.map((tool) => {
    const parameters = isGeminiSchema(tool.parameters)
      ? tool.parameters
      : { type: 'OBJECT', properties: {} };

    return new FunctionTool({
      name: tool.name,
      description: tool.description,
      parameters,
      execute: async (input) => {
        const args: Record<string, unknown> = {};
        if (typeof input === 'object' && input !== null) {
          for (const [key, value] of Object.entries(input)) {
            args[key] = value;
          }
        }
        const result = await tool.execute(args);
        return wrapToolResult(result);
      },
    });
  });
}
