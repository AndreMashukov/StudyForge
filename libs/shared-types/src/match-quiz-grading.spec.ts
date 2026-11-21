import { describe, expect, it } from 'vitest';
import {
  isMatchAnswerCorrect,
  isMatchPlacementCorrect,
  normalizeMatchOptionText,
} from './match-quiz-grading';

// Mirrors the reported question: three rows share "LangGraph", two share
// "Claude Agent SDK", plus one distractor.
const question = {
  prompts: [
    { id: 'p1' },
    { id: 'p2' },
    { id: 'p3' },
    { id: 'p4' },
    { id: 'p5' },
  ],
  options: [
    { id: 'o1', text: 'Claude Agent SDK', correctPromptId: 'p1' },
    { id: 'o2', text: 'LangGraph', correctPromptId: 'p2' },
    { id: 'o3', text: 'LangGraph', correctPromptId: 'p3' },
    { id: 'o4', text: 'Claude Agent SDK', correctPromptId: 'p4' },
    { id: 'o5', text: 'LangGraph ', correctPromptId: 'p5' },
    { id: 'o6', text: 'MCP client', correctPromptId: null },
  ],
};

describe('match quiz grading', () => {
  it('accepts the generated option for a row', () => {
    expect(isMatchPlacementCorrect(question, 'p2', 'o2')).toBe(true);
  });

  it('treats identical-text chips as interchangeable', () => {
    expect(isMatchPlacementCorrect(question, 'p2', 'o3')).toBe(true);
    expect(isMatchPlacementCorrect(question, 'p2', 'o5')).toBe(true);
    expect(isMatchPlacementCorrect(question, 'p1', 'o4')).toBe(true);
  });

  it('rejects a chip with different text', () => {
    expect(isMatchPlacementCorrect(question, 'p2', 'o1')).toBe(false);
    expect(isMatchPlacementCorrect(question, 'p2', 'o6')).toBe(false);
  });

  it('rejects missing or unknown placements', () => {
    expect(isMatchPlacementCorrect(question, 'p2', undefined)).toBe(false);
    expect(isMatchPlacementCorrect(question, 'p2', 'nope')).toBe(false);
    expect(isMatchPlacementCorrect(question, 'p9', 'o2')).toBe(false);
  });

  it('grades a full answer with swapped duplicate chips as correct', () => {
    expect(
      isMatchAnswerCorrect(question, ['o4', 'o5', 'o2', 'o1', 'o3']),
    ).toBe(true);
  });

  it('grades a full answer with a wrong row as incorrect', () => {
    expect(
      isMatchAnswerCorrect(question, ['o2', 'o1', 'o3', 'o4', 'o5']),
    ).toBe(false);
  });

  it('requires one placement per prompt', () => {
    expect(isMatchAnswerCorrect(question, ['o1', 'o2'])).toBe(false);
  });

  it('normalizes case and whitespace', () => {
    expect(normalizeMatchOptionText('  Lang   Graph ')).toBe('lang graph');
  });
});
