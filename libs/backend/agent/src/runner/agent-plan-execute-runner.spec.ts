import { describe, expect, it } from 'vitest';
import {
  agentPlanOutputSchema,
  parseAgentPlanOutput,
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
