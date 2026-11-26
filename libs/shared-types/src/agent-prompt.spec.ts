import { describe, expect, it } from 'vitest';
import {
  agentPromptAttachError,
  AGENT_PROMPT_CONTENT_MAX,
  buildAgentPromptMenu,
  buildAgentPromptRunMessage,
  findAgentPromptSlashTrigger,
  formatAgentPromptShortForm,
  toggleRuleApplicabilityValue,
  validateAgentPromptRule,
} from './agent-prompt';
import { startAgentTurnRequestSchema } from './agent-turn';
import { parseRuleBlueprintForm } from './rule-blueprints';

describe('validateAgentPromptRule', () => {
  it('accepts non-agent rules untouched', () => {
    expect(
      validateAgentPromptRule({
        applicableTo: ['quiz', 'prompt'],
        content: 'x'.repeat(AGENT_PROMPT_CONTENT_MAX + 1),
        directoryIds: ['d1'],
      }),
    ).toBeNull();
  });

  it('accepts a short agent-only rule attached nowhere', () => {
    expect(
      validateAgentPromptRule({ applicableTo: ['agent'], content: 'Recap today' }),
    ).toBeNull();
  });

  it('refuses agent combined with other types', () => {
    expect(
      validateAgentPromptRule({ applicableTo: ['agent', 'quiz'], content: 'x' }),
    ).toMatch(/cannot apply to anything else/);
  });

  it('refuses agent prompts over the length limit', () => {
    expect(
      validateAgentPromptRule({
        applicableTo: ['agent'],
        content: 'x'.repeat(AGENT_PROMPT_CONTENT_MAX + 1),
      }),
    ).toMatch(/at most 10,000/);
  });

  it('refuses switching an attached rule to agent', () => {
    expect(
      validateAgentPromptRule({
        applicableTo: ['agent'],
        content: 'x',
        directoryIds: ['d1'],
      }),
    ).toMatch(/Detach/);
  });
});

describe('agentPromptAttachError', () => {
  it('blocks attaching agent prompts only', () => {
    expect(agentPromptAttachError(['agent'])).toMatch(/cannot be attached/);
    expect(agentPromptAttachError(['quiz'])).toBeNull();
    expect(agentPromptAttachError(undefined)).toBeNull();
  });
});

describe('toggleRuleApplicabilityValue', () => {
  it('keeps agent exclusive both ways', () => {
    expect(toggleRuleApplicabilityValue(['quiz', 'prompt'], 'agent')).toEqual([
      'agent',
    ]);
    expect(toggleRuleApplicabilityValue(['agent'], 'quiz')).toEqual(['quiz']);
    expect(toggleRuleApplicabilityValue(['quiz'], 'prompt')).toEqual([
      'quiz',
      'prompt',
    ]);
    expect(toggleRuleApplicabilityValue(['agent'], 'agent')).toEqual([]);
  });
});

describe('findAgentPromptSlashTrigger', () => {
  it('opens at the start or after whitespace', () => {
    expect(findAgentPromptSlashTrigger('/', 1)).toEqual({ query: '', start: 0 });
    expect(findAgentPromptSlashTrigger('hi /rec', 7)).toEqual({
      query: 'rec',
      start: 3,
    });
  });

  it('ignores slashes inside words, URLs and finished tokens', () => {
    expect(findAgentPromptSlashTrigger('and/or', 6)).toBeNull();
    expect(findAgentPromptSlashTrigger('https://x.com/a', 15)).toBeNull();
    expect(findAgentPromptSlashTrigger('/recap more', 11)).toBeNull();
    expect(findAgentPromptSlashTrigger('no slash', 8)).toBeNull();
  });

  it('uses the caret, not the end of the text', () => {
    expect(findAgentPromptSlashTrigger('/qu later', 3)).toEqual({
      query: 'qu',
      start: 0,
    });
  });
});

describe('buildAgentPromptMenu', () => {
  const rules = [
    { id: 'r1', name: 'Quiz recap', description: 'Poem and diagram', applicableTo: ['agent'] },
    { id: 'r2', name: 'Biology format', applicableTo: ['prompt'] },
    {
      id: 'r3',
      name: 'Yesterday recap',
      applicableTo: ['agent'],
      sourceBlueprintId: 'bp-yesterday',
    },
  ];
  const suggested = [
    { id: 'bp-yesterday', name: 'Yesterday activity recap doc', content: 'x', version: 1 },
    { id: 'bp-week', name: 'Weekly plan', description: 'Plan the week', content: 'y', version: 2 },
  ];

  it('lists own agent prompts first and hides copied suggestions', () => {
    const menu = buildAgentPromptMenu({ rules, suggested, query: '' });
    expect(menu.own.map((item) => item.id)).toEqual(['r1', 'r3']);
    expect(menu.suggested.map((item) => item.id)).toEqual(['bp-week']);
    expect(menu.own[0]).toMatchObject({ source: 'rule', description: 'Poem and diagram' });
    expect(menu.suggested[0]).toMatchObject({ source: 'blueprint' });
  });

  it('filters by name words and description', () => {
    expect(
      buildAgentPromptMenu({ rules, suggested, query: 'rec' }).own.map((i) => i.id),
    ).toEqual(['r1', 'r3']);
    expect(
      buildAgentPromptMenu({ rules, suggested, query: 'quiz' }).own.map((i) => i.id),
    ).toEqual(['r1']);
    expect(
      buildAgentPromptMenu({ rules, suggested, query: 'poem' }).own.map((i) => i.id),
    ).toEqual(['r1']);
    expect(
      buildAgentPromptMenu({ rules, suggested, query: 'zzz' }),
    ).toEqual({ own: [], suggested: [] });
  });
});

describe('agent prompt run text', () => {
  it('formats the short form', () => {
    expect(formatAgentPromptShortForm('Quiz recap', '')).toBe('/Quiz recap');
    expect(formatAgentPromptShortForm('Quiz recap', ' only biology ')).toBe(
      '/Quiz recap — only biology',
    );
  });

  it('frames the saved text as the user request with extra detail', () => {
    const message = buildAgentPromptRunMessage({
      name: 'Quiz recap',
      content: 'Recap my quizzes from today.',
      extra: 'only biology',
    });
    expect(message).toContain('[Saved prompt "Quiz recap"');
    expect(message).toContain('\nRecap my quizzes from today.\n');
    expect(message).toContain('[Extra detail from the user for this run, which wins where it conflicts: only biology]');
    expect(message).not.toMatch(/<[a-z_]+>/);
    expect(
      buildAgentPromptRunMessage({ name: 'Quiz recap', content: 'Recap.', extra: ' ' }),
    ).not.toContain('Extra detail');
  });
});

describe('startAgentTurnRequestSchema with agentPrompt', () => {
  const base = { threadId: 'thread-12345', turnId: 'turn-123456' };

  it('allows an empty message when a prompt is picked', () => {
    const parsed = startAgentTurnRequestSchema.safeParse({
      ...base,
      agentPrompt: { source: 'rule', id: 'r1' },
    });
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.message).toBe('');
  });

  it('still requires a message without a prompt', () => {
    expect(startAgentTurnRequestSchema.safeParse({ ...base, message: '  ' }).success).toBe(
      false,
    );
  });

  it('refuses a prompt with the starter course intent', () => {
    expect(
      startAgentTurnRequestSchema.safeParse({
        ...base,
        intent: 'starter_course',
        agentPrompt: { source: 'blueprint', id: 'bp' },
      }).success,
    ).toBe(false);
  });
});

describe('agent blueprints', () => {
  const blueprint = {
    name: 'Yesterday activity recap doc',
    content: 'Recap yesterday.',
    color: 'purple',
    tags: [],
  };

  it('accepts an agent-only blueprint', () => {
    expect(parseRuleBlueprintForm({ ...blueprint, applicableTo: ['agent'] }).applicableTo).toEqual([
      'agent',
    ]);
  });

  it('refuses mixing agent with other types', () => {
    expect(() =>
      parseRuleBlueprintForm({ ...blueprint, applicableTo: ['agent', 'quiz'] }),
    ).toThrow(/cannot apply to anything else/);
  });
});
