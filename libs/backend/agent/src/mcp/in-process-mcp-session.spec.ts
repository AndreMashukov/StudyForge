import { describe, expect, it } from 'vitest';
import type { AgentToolDefinition } from '../tools/create-agent-tools';
import { createInProcessMcpSession } from './in-process-mcp-session';

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

describe('createInProcessMcpSession', () => {
  it('lists OpenAI-shaped tools from MCP listTools', async () => {
    const session = await createInProcessMcpSession(fixtureDefinitions());
    try {
      const tools = session.listOpenAiTools();
      expect(tools).toHaveLength(3);
      expect(tools[0]).toMatchObject({
        type: 'function',
        function: {
          name: 'echo',
          description: 'Echoes the query back.',
        },
      });
      expect(tools[0]?.function.parameters).toMatchObject({
        type: 'object',
        properties: {
          query: { type: 'string' },
        },
      });
    } finally {
      await session.close();
    }
  });

  it('returns tool catalog entries for the planner', async () => {
    const session = await createInProcessMcpSession(fixtureDefinitions());
    try {
      expect(session.listToolCatalog()).toEqual([
        { name: 'echo', description: 'Echoes the query back.' },
        { name: 'fail', description: 'Always fails.' },
        { name: 'void_result', description: 'Returns undefined.' },
      ]);
    } finally {
      await session.close();
    }
  });

  it('callTool returns parsed execute results', async () => {
    const session = await createInProcessMcpSession(fixtureDefinitions());
    try {
      await expect(session.callTool('echo', { query: 'hi' })).resolves.toEqual({
        echoed: 'hi',
      });
    } finally {
      await session.close();
    }
  });

  it('callTool returns null when execute returns undefined', async () => {
    const session = await createInProcessMcpSession(fixtureDefinitions());
    try {
      await expect(session.callTool('void_result', {})).resolves.toBeNull();
    } finally {
      await session.close();
    }
  });

  it('callTool throws on execute errors', async () => {
    const session = await createInProcessMcpSession(fixtureDefinitions());
    try {
      await expect(session.callTool('fail', {})).rejects.toThrow('boom');
    } finally {
      await session.close();
    }
  });

  it('requires a fresh session after close', async () => {
    const session = await createInProcessMcpSession(fixtureDefinitions());
    await session.close();
    await expect(session.callTool('echo', { query: 'hi' })).rejects.toThrow(
      'In-process MCP session is closed',
    );
  });

  it('close is idempotent', async () => {
    const session = await createInProcessMcpSession(fixtureDefinitions());
    await session.close();
    await expect(session.close()).resolves.toBeUndefined();
  });
});
