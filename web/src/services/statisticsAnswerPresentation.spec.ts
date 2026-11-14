import { describe, expect, it } from 'vitest';
import {
  statisticsAnswerLabel,
  statisticsMatchPairs,
  statisticsQuestionMetadata,
} from './statisticsAnswerPresentation';

const match = statisticsQuestionMetadata({
  prompts: [
    { id: 'p1', text: 'Personal tenant' },
    { id: 'p2', text: 'Organisation user' },
  ],
  options: [
    { id: 'o2', text: 'Organisation auth user' },
    { id: 'd', text: 'Distractor' },
    { id: 'o1', text: 'Personal tenant record' },
  ],
});
describe('Progress answer presentation', () => {
  it('resolves zero-based quiz choices to their complete text without shifting malformed positions', () => {
    const question = statisticsQuestionMetadata({
      options: ['First answer', null, 'Complete third answer'],
    });
    expect(statisticsAnswerLabel(0, question, 'quiz')).toBe('First answer');
    expect(statisticsAnswerLabel(2, question, 'quiz')).toBe(
      'Complete third answer',
    );
    expect(statisticsAnswerLabel(1, question, 'quiz')).toBe(
      'Answer text unavailable',
    );
  });
  it('never presents an index as an answer when content is missing, deleted, or invalid', () => {
    for (const value of [0, -1, 20, 0.5])
      expect(statisticsAnswerLabel(value, undefined, 'quiz')).toBe(
        'Answer text unavailable',
      );
    expect(statisticsAnswerLabel(null, undefined, 'quiz')).toBe('No answer');
  });
  it('maps match IDs by identity and compares pairs in prompt order, independent of option-bank order', () => {
    expect(statisticsMatchPairs(['o2', 'o2'], ['o1', 'o2'], match)).toEqual([
      {
        prompt: 'Personal tenant',
        selectedText: 'Organisation auth user',
        correctText: 'Personal tenant record',
        isCorrect: false,
      },
      {
        prompt: 'Organisation user',
        selectedText: 'Organisation auth user',
        correctText: 'Organisation auth user',
        isCorrect: true,
      },
    ]);
    expect(statisticsAnswerLabel(['o2', 'o1'], match, 'matchQuiz')).toBe(
      'Personal tenant → Organisation auth user; Organisation user → Personal tenant record',
    );
  });
  it('distinguishes unplaced matches from deleted option content and handles missing question metadata', () => {
    const pairs = statisticsMatchPairs(['', 'deleted'], ['o1', 'o2'], match);
    expect(pairs.map((pair) => pair.selectedText)).toEqual([
      'No answer',
      'Answer text unavailable',
    ]);
    expect(statisticsAnswerLabel(['o1'], undefined, 'matchQuiz')).toBe(
      'Answer text unavailable',
    );
    expect(statisticsMatchPairs(['o1'], ['o2'], undefined)).toEqual([]);
  });
  it('keeps sequence text and diagram indexes intact', () => {
    expect(
      statisticsAnswerLabel(
        ['Validate', 'Create membership'],
        undefined,
        'sequenceQuiz',
      ),
    ).toBe('Validate, Create membership');
    const question = statisticsQuestionMetadata({
      diagramLabels: [null, 'Authorise before granting access'],
      diagrams: [null, 'flowchart LR; A-->B'],
    });
    expect(statisticsAnswerLabel(1, question, 'diagramQuiz')).toBe(
      'Authorise before granting access',
    );
    expect(question.diagrams[1]).toBe('flowchart LR; A-->B');
  });
});
