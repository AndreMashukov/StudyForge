import { describe, expect, it } from 'vitest';
import type { AgentToolDefinition } from './create-agent-tools';
import { createAgentToolSession } from './agent-tool-session';

function fixtureDefinitions(): AgentToolDefinition[] {
  return [
    {
      name: 'echo',
      description: 'Echoes the query back.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string' },
        },
        required: ['query'],
      },
      execute: async (args) => ({
        echoed: typeof args.query === 'string' ? args.query : '',
      }),
    },
    {
      name: 'fail',
      description: 'Always fails.',
      parameters: { type: 'object', properties: {} },
      execute: async () => {
        throw new Error('boom');
      },
    },
    {
      name: 'void_result',
      description: 'Returns undefined.',
      parameters: { type: 'object', properties: {} },
      execute: async () => {
        return undefined;
      },
    },
  ];
}

describe('createAgentToolSession', () => {
  it('lists OpenAI-shaped tools from the definitions', () => {
    const session = createAgentToolSession(fixtureDefinitions());
    const tools = session.listOpenAiTools();
    expect(tools).toHaveLength(3);
    expect(tools[0]).toEqual({
      type: 'function',
      function: {
        name: 'echo',
        description: 'Echoes the query back.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string' },
          },
          required: ['query'],
        },
      },
    });
  });

  it('returns tool catalog entries for the planner', () => {
    const session = createAgentToolSession(fixtureDefinitions());
    expect(session.listToolCatalog()).toEqual([
      { name: 'echo', description: 'Echoes the query back.' },
      { name: 'fail', description: 'Always fails.' },
      { name: 'void_result', description: 'Returns undefined.' },
    ]);
  });

  it('callTool returns the execute result', async () => {
    const session = createAgentToolSession(fixtureDefinitions());
    await expect(session.callTool('echo', { query: 'hi' })).resolves.toEqual({
      echoed: 'hi',
    });
  });

  it('callTool returns undefined when execute returns undefined', async () => {
    const session = createAgentToolSession(fixtureDefinitions());
    await expect(session.callTool('void_result', {})).resolves.toBeUndefined();
  });

  it('callTool throws on execute errors', async () => {
    const session = createAgentToolSession(fixtureDefinitions());
    await expect(session.callTool('fail', {})).rejects.toThrow('boom');
  });

  it('callTool throws when the tool name is unknown', async () => {
    const session = createAgentToolSession(fixtureDefinitions());
    await expect(session.callTool('missing', {})).rejects.toThrow(
      'Unknown tool: missing',
    );
  });
});
