import { describe, expect, it } from 'vitest';
import type { Content } from '@google/genai';
import {
  geminiContentsToToolChatMessages,
  llmRequestToOpenAiTools,
  readSystemInstruction,
  toolChatAssistantToContent,
} from './adk-content-converter';

describe('adk content converter', () => {
  it('reads system instruction from string or content parts', () => {
    expect(readSystemInstruction('You are helpful.')).toBe('You are helpful.');
    expect(
      readSystemInstruction({
        role: 'user',
        parts: [{ text: 'Stay in scope.' }],
      }),
    ).toBe('Stay in scope.');
  });

  it('converts user and model text contents', () => {
    const contents: Content[] = [
      { role: 'user', parts: [{ text: 'create a recap doc' }] },
      { role: 'model', parts: [{ text: 'I will create it.' }] },
    ];

    expect(geminiContentsToToolChatMessages(contents)).toEqual([
      { role: 'user', content: 'create a recap doc' },
      { role: 'assistant', content: 'I will create it.' },
    ]);
  });

  it('converts function calls and responses into tool chat messages', () => {
    const contents: Content[] = [
      {
        role: 'model',
        parts: [
          {
            functionCall: {
              id: 'call-1',
              name: 'create_document',
              args: { title: 'Recap', prompt: 'Write the recap.' },
            },
          },
        ],
      },
      {
        role: 'user',
        parts: [
          {
            functionResponse: {
              id: 'call-1',
              name: 'create_document',
              response: { id: 'doc-1', title: 'Recap' },
            },
          },
        ],
      },
    ];

    expect(geminiContentsToToolChatMessages(contents)).toEqual([
      {
        role: 'assistant',
        content: null,
        tool_calls: [
          {
            id: 'call-1',
            type: 'function',
            function: {
              name: 'create_document',
              arguments: '{"title":"Recap","prompt":"Write the recap."}',
            },
          },
        ],
      },
      {
        role: 'tool',
        name: 'create_document',
        tool_call_id: 'call-1',
        content: '{"id":"doc-1","title":"Recap"}',
      },
    ]);
  });

  it('converts assistant tool calls back to model content', () => {
    const content = toolChatAssistantToContent({
      role: 'assistant',
      content: null,
      tool_calls: [
        {
          id: 'call-1',
          type: 'function',
          function: {
            name: 'list_documents',
            arguments: '{"directoryId":"recap-1"}',
          },
        },
      ],
    });

    expect(content.role).toBe('model');
    expect(content.parts?.[0]?.functionCall).toEqual({
      id: 'call-1',
      name: 'list_documents',
      args: { directoryId: 'recap-1' },
    });
  });

  it('extracts OpenAI tool definitions from an LLM request', () => {
    expect(
      llmRequestToOpenAiTools({
        config: {
          tools: [
            {
              functionDeclarations: [
                {
                  name: 'list_documents',
                  description: 'List documents',
                  parameters: {
                    type: 'OBJECT',
                    properties: { directoryId: { type: 'STRING' } },
                  },
                },
              ],
            },
          ],
        },
      }),
    ).toEqual([
      {
        type: 'function',
        function: {
          name: 'list_documents',
          description: 'List documents',
          parameters: {
            type: 'object',
            properties: { directoryId: { type: 'string' } },
          },
        },
      },
    ]);
  });
});
