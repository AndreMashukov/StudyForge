import { beforeEach, describe, expect, it, vi } from 'vitest';

const getRule = vi.fn();
const getPublishedAgentBlueprint = vi.fn();

vi.mock('@study-forge/backend-directories/rule-crud', () => ({
  getRule: (...args: unknown[]) => getRule(...args),
}));
vi.mock('@study-forge/backend-directories/rule-blueprints', () => ({
  getPublishedAgentBlueprint: (...args: unknown[]) =>
    getPublishedAgentBlueprint(...args),
}));

import { loadAgentPromptRun } from './agent-prompt-loader';

describe('loadAgentPromptRun', () => {
  beforeEach(() => {
    getRule.mockReset();
    getPublishedAgentBlueprint.mockReset();
  });

  it('loads the current text of the learner agent prompt', async () => {
    getRule.mockResolvedValue({
      id: 'r1',
      name: ' Quiz recap ',
      content: ' Recap today. ',
      applicableTo: ['agent'],
    });
    await expect(
      loadAgentPromptRun('u1', { source: 'rule', id: 'r1' }),
    ).resolves.toEqual({
      source: 'rule',
      id: 'r1',
      name: 'Quiz recap',
      content: 'Recap today.',
    });
    expect(getRule).toHaveBeenCalledWith('u1', 'r1');
  });

  it('loads a published agent blueprint for a suggested prompt', async () => {
    getPublishedAgentBlueprint.mockResolvedValue({
      id: 'bp',
      name: 'Yesterday recap',
      content: 'Recap yesterday.',
      applicableTo: ['agent'],
    });
    await expect(
      loadAgentPromptRun('u1', { source: 'blueprint', id: 'bp' }),
    ).resolves.toMatchObject({ source: 'blueprint', name: 'Yesterday recap' });
  });

  it('refuses a deleted prompt or a rule that is not an agent prompt', async () => {
    getRule.mockResolvedValueOnce(null);
    await expect(
      loadAgentPromptRun('u1', { source: 'rule', id: 'gone' }),
    ).rejects.toThrow('This prompt no longer exists.');

    getRule.mockResolvedValueOnce({
      id: 'r2',
      name: 'Biology format',
      content: 'Format',
      applicableTo: ['prompt'],
    });
    await expect(
      loadAgentPromptRun('u1', { source: 'rule', id: 'r2' }),
    ).rejects.toThrow('This prompt no longer exists.');
  });
});
