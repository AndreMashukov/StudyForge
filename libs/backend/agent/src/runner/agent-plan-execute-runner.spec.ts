import { describe, expect, it } from 'vitest';
import {
  agentPlanOutputSchema,
  buildGroundedCreateReply,
  composeExecutorStepResult,
  hasSuccessfulCreateDocument,
  parseAgentPlanOutput,
  shouldBlockUngroundedCreateResponse,
} from './agent-plan-execute-runner';

describe('parseAgentPlanOutput', () => {
  it('parses a plan response', () => {
    const parsed = parseAgentPlanOutput(
      '{"type":"plan","steps":["List directories","Create folder"]}',
    );

    expect(parsed).toEqual({
      type: 'plan',
      steps: ['List directories', 'Create folder'],
    });
  });

  it('parses a direct response', () => {
    const parsed = parseAgentPlanOutput(
      '{"type":"response","response":"Hello! How can I help?"}',
    );

    expect(parsed).toEqual({
      type: 'response',
      response: 'Hello! How can I help?',
    });
  });

  it('accepts fenced JSON', () => {
    const parsed = parseAgentPlanOutput(
      '```json\n{"type":"response","response":"Done"}\n```',
    );

    expect(parsed).toEqual({
      type: 'response',
      response: 'Done',
    });
  });

  it('returns null for invalid payloads', () => {
    expect(parseAgentPlanOutput('not json')).toBeNull();
    expect(parseAgentPlanOutput('{"type":"plan","steps":[]}')).toBeNull();
  });
});

describe('agentPlanOutputSchema', () => {
  it('rejects more than eight steps', () => {
    const result = agentPlanOutputSchema.safeParse({
      type: 'plan',
      steps: Array.from({ length: 9 }, (_, index) => `Step ${index + 1}`),
    });

    expect(result.success).toBe(false);
  });
});

describe('create_document grounding', () => {
  const createObjective =
    'can you create a new doc using Mermaid Diagrams rules add poetic summary too';

  it('blocks a create reply when create_document never returned an id', () => {
    expect(
      shouldBlockUngroundedCreateResponse({
        objective: createObjective,
        outcomes: [],
      }),
    ).toBe(true);
    expect(
      shouldBlockUngroundedCreateResponse({
        objective: createObjective,
        outcomes: [
          {
            name: 'list_documents',
            ok: true,
            result: [{ id: 'drBg2dRZYhMUrdHtmFEo', title: 'Existing recap' }],
          },
        ],
      }),
    ).toBe(true);
  });

  it('allows a create reply only when create_document returned an id', () => {
    expect(
      shouldBlockUngroundedCreateResponse({
        objective: createObjective,
        outcomes: [
          {
            name: 'create_document',
            ok: true,
            result: { id: 'bX8p8Z9q3Gvx9oQLxH1R', title: 'New recap' },
          },
        ],
      }),
    ).toBe(false);
  });

  it('does not treat executor prose as a successful create', () => {
    expect(
      hasSuccessfulCreateDocument([
        {
          name: 'create_document',
          ok: true,
          result: 'Your new document is ready',
        },
      ]),
    ).toBe(false);
  });

  it('builds a grounded reply from the real create_document id', () => {
    expect(
      buildGroundedCreateReply([
        {
          name: 'create_document',
          ok: true,
          result: {
            id: 'faEQ0X2oh8iJBZqF3i5v',
            title: 'LangGraph Recap — Knowledge Gap Analysis (2026-08-12)',
          },
        },
      ]),
    ).toBe(
      'Started generating document "LangGraph Recap — Knowledge Gap Analysis (2026-08-12)".\nID: faEQ0X2oh8iJBZqF3i5v',
    );
    expect(buildGroundedCreateReply([])).toBeNull();
  });

  it('lists verified tool ids separately from unverified executor notes', () => {
    const text = composeExecutorStepResult('Created K7p3X9mNqR2vY8wZ4jL5', [
      {
        name: 'list_documents',
        ok: true,
        result: [
          { id: 'drBg2dRZYhMUrdHtmFEo', title: 'LangGraph Recap' },
          { id: 'Pa5oXQQGD76JnHi8w7cA', title: 'LangGraph Recap Quiz' },
        ],
      },
    ]);

    expect(text).toContain('id=drBg2dRZYhMUrdHtmFEo');
    expect(text).toContain('id=Pa5oXQQGD76JnHi8w7cA');
    expect(text).toContain('Executor notes (unverified');
    expect(text).toContain('Created K7p3X9mNqR2vY8wZ4jL5');
  });
});
