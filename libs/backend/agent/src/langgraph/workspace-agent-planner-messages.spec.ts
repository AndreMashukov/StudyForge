import { describe, expect, it } from 'vitest';
import { buildWorkspacePlannerMessages } from './workspace-agent-planner-messages';

describe('buildWorkspacePlannerMessages', () => {
  it('keeps the original objective on a JSON retry', () => {
    const messages = buildWorkspacePlannerMessages({
      instruction: 'system',
      userMessage: 'Objective:\nExplain condensation',
      previousInvalidContent: 'not json',
    });

    expect(messages[0]).toEqual({ role: 'system', content: 'system' });
    expect(messages[1]).toEqual({
      role: 'user',
      content: 'Objective:\nExplain condensation',
    });
    expect(messages[2]).toEqual({ role: 'assistant', content: 'not json' });
    expect(messages[3]?.role).toBe('user');
    expect(messages[3]?.content).toContain('invalid JSON');
    expect(messages[3]?.content).toContain('original objective');
  });
});
