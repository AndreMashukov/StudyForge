import { describe, expect, it } from 'vitest';
import {
  agentPlanOutputSchema,
  buildGroundedCreateReply,
  buildPlannerUserMessage,
  composeExecutorStepResult,
  formatConversationHistory,
  hasSuccessfulCreateDocument,
  isCreateDocumentObjective,
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

  it('still treats an explicit create-doc request as a create objective', () => {
    expect(isCreateDocumentObjective(createObjective)).toBe(true);
  });

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

  it('does not treat a propose-first study plan as a create-document request', () => {
    const studyPlanObjective =
      'In this dir I want you to create a study plan for learning Python - intermediate level (I already know the basics), each doc should contain explanation of several not trivial subjects with, code snippets, mermaid diagrams and table with comparison between javascript and python (modern python), you can attach existing rules to the dir (or create new rules if needed), so first before start suggest a study plan so that I can validate it';

    expect(isCreateDocumentObjective(studyPlanObjective)).toBe(false);
    expect(
      shouldBlockUngroundedCreateResponse({
        objective: studyPlanObjective,
        outcomes: [],
      }),
    ).toBe(false);
  });

  it('does not force create when the user asks to validate a plan first', () => {
    const proposeThenCreate =
      'create documents for an intermediate Python course, but first suggest a study plan so I can validate it';

    expect(isCreateDocumentObjective(proposeThenCreate)).toBe(false);
    expect(
      shouldBlockUngroundedCreateResponse({
        objective: proposeThenCreate,
        outcomes: [],
      }),
    ).toBe(false);
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

describe('planner conversation history', () => {
  it('omits the recent conversation section when history is empty', () => {
    const message = buildPlannerUserMessage({
      objective: 'try to regenerate',
      history: [],
      pastSteps: [],
    });

    expect(message).not.toContain('Recent conversation:');
    expect(message).toContain('Objective:\ntry to regenerate');
  });

  it('includes prior turns so follow-ups can resolve the last document', () => {
    const history = [
      {
        role: 'user' as const,
        content:
          'create a new doc using Mermaid Diagrams rules add poetic summary too',
      },
      {
        role: 'assistant' as const,
        content:
          'Started generating document "Knowledge Gaps Recap".\n\n[Executed actions]\n- create_document id=HBETddUOzkX4G2ILTCGD Started document generation for "Knowledge Gaps Recap"',
      },
    ];

    expect(formatConversationHistory(history)).toContain(
      'id=HBETddUOzkX4G2ILTCGD',
    );

    const message = buildPlannerUserMessage({
      objective: 'try to regenerate',
      history,
      pastSteps: [],
    });

    expect(message).toContain('Recent conversation:');
    expect(message).toContain('Knowledge Gaps Recap');
    expect(message).toContain('id=HBETddUOzkX4G2ILTCGD');
    expect(message).toContain('Objective:\ntry to regenerate');
  });
});
