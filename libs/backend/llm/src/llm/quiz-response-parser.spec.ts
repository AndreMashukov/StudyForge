import { describe, expect, it } from 'vitest';
import {
  extractBalancedJsonObject,
  parseQuizJson,
  repairQuizJsonEnvelope,
} from './quiz-response-parser';

const SAMPLE_QUESTION = `{
      "question": "What is machine learning?",
      "options": ["A", "B", "C", "D"],
      "correctAnswer": 0,
      "explanation": "ML learns from experience."
    }`;

describe('repairQuizJsonEnvelope', () => {
  it('wraps bare title string before questions array (MiniMax M3 pattern)', () => {
    const raw = `"Machine Learning Quiz",
  "questions": [
    ${SAMPLE_QUESTION}
  ]
}`;
    const repaired = repairQuizJsonEnvelope(raw);
    expect(repaired.startsWith('{"title":"Machine Learning Quiz","questions":[')).toBe(true);
    expect(JSON.parse(repaired).title).toBe('Machine Learning Quiz');
  });

  it('adds missing outer brace when title key is present', () => {
    const raw = `"title": "Machine Learning Quiz",
  "questions": [
    ${SAMPLE_QUESTION}
  ]
}`;
    const repaired = repairQuizJsonEnvelope(raw);
    expect(repaired.startsWith('{')).toBe(true);
    expect(JSON.parse(repaired).questions).toHaveLength(1);
  });
});

describe('extractBalancedJsonObject', () => {
  it('returns the outer object, not the first nested question object', () => {
    const text = `{"title":"Quiz","questions":[${SAMPLE_QUESTION},${SAMPLE_QUESTION}]}`;
    expect(extractBalancedJsonObject(text)).toBe(text);
  });
});

describe('parseQuizJson', () => {
  it('parses valid quiz JSON', () => {
    const raw = `{"title":"Quiz","questions":[${SAMPLE_QUESTION}]}`;
    const parsed = parseQuizJson(raw);
    expect(parsed.title).toBe('Quiz');
    expect(parsed.questions).toHaveLength(1);
  });

  it('parses MiniMax-style bare title without outer wrapper', () => {
    const raw = `"Machine Learning Fundamentals Quiz",
  "questions": [
    ${SAMPLE_QUESTION},
    {
      "question": "What is supervised learning?",
      "options": ["A", "B", "C", "D"],
      "correctAnswer": 1,
      "explanation": "Uses labeled data."
    }
  ]
}`;
    const parsed = parseQuizJson(raw);
    expect(parsed.title).toBe('Machine Learning Fundamentals Quiz');
    expect(parsed.questions).toHaveLength(2);
  });

  it('strips thinking wrappers before parsing', () => {
    const raw = `<mm:think>planning</mm:think>
"title": "Wrapped Quiz",
  "questions": [
    ${SAMPLE_QUESTION}
  ]
}`;
    const parsed = parseQuizJson(raw);
    expect(parsed.title).toBe('Wrapped Quiz');
  });
});
