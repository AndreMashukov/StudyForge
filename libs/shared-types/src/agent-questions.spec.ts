import { describe, expect, it } from 'vitest';
import type { AgentQuestion } from './agent';
import {
  AGENT_QUESTION_SKIPPED_ANSWER,
  formatAgentQuestionAnswers,
  normalizeAgentQuestions,
  recommendedAgentQuestionOption,
} from './agent-questions';

describe('normalizeAgentQuestions', () => {
  it('keeps a well-formed question and defaults allowOther to true', () => {
    const [question] = normalizeAgentQuestions([
      {
        id: 'folder',
        header: 'Folder',
        question: 'Which folder should the flashcards go in?',
        options: [
          { label: 'AWS', description: 'Your AWS notes', recommended: true },
          { label: 'New folder' },
        ],
      },
    ]);
    expect(question).toEqual({
      id: 'folder',
      header: 'Folder',
      question: 'Which folder should the flashcards go in?',
      options: [
        { label: 'AWS', description: 'Your AWS notes', recommended: true },
        { label: 'New folder' },
      ],
      allowOther: true,
    });
  });

  it('keeps only the first recommended option', () => {
    const [question] = normalizeAgentQuestions([
      {
        question: 'Pick one',
        options: [
          { label: 'A', recommended: true },
          { label: 'B', recommended: true },
        ],
      },
    ]);
    expect(question?.options.filter((o) => o.recommended)).toHaveLength(1);
    expect(question && recommendedAgentQuestionOption(question)?.label).toBe(
      'A',
    );
  });

  it('accepts plain string options, dedupes labels and caps the count', () => {
    const [question] = normalizeAgentQuestions([
      {
        question: 'Pick',
        options: ['One', 'one', 'Two', 'Three', 'Four', 'Five'],
      },
    ]);
    expect(question?.options.map((o) => o.label)).toEqual([
      'One',
      'Two',
      'Three',
      'Four',
    ]);
  });

  it('drops questions without text or with fewer than two options', () => {
    expect(
      normalizeAgentQuestions([
        { question: '', options: ['A', 'B'] },
        { question: 'Only one?', options: ['A'] },
        'not an object',
      ]),
    ).toEqual([]);
    expect(normalizeAgentQuestions(undefined)).toEqual([]);
  });

  it('fills in unique ids and caps the number of questions', () => {
    const raw = Array.from({ length: 6 }, () => ({
      id: 'same',
      question: 'Q?',
      options: ['A', 'B'],
    }));
    const questions = normalizeAgentQuestions(raw);
    expect(questions).toHaveLength(4);
    expect(new Set(questions.map((q) => q.id)).size).toBe(4);
  });

  it('honours allowOther: false', () => {
    const [question] = normalizeAgentQuestions([
      { question: 'Yes or no?', options: ['Yes', 'No'], allowOther: false },
    ]);
    expect(question?.allowOther).toBe(false);
  });
});

describe('formatAgentQuestionAnswers', () => {
  const first: AgentQuestion = {
    id: 'q1',
    question: 'Which folder?',
    options: [{ label: 'AWS' }, { label: 'GCP' }],
    allowOther: true,
  };
  const second: AgentQuestion = {
    id: 'q2',
    question: 'How many cards?',
    options: [{ label: '10' }, { label: '20' }],
    allowOther: true,
  };

  it('repeats each question with its answer', () => {
    expect(
      formatAgentQuestionAnswers([
        { question: first, answer: 'AWS' },
        { question: second, answer: '25 please' },
      ]),
    ).toBe('Which folder?\n→ AWS\n\nHow many cards?\n→ 25 please');
  });

  it('marks skipped questions so the agent decides', () => {
    expect(
      formatAgentQuestionAnswers([{ question: first, answer: null }]),
    ).toBe(`Which folder?\n→ ${AGENT_QUESTION_SKIPPED_ANSWER}`);
  });
});
