import { describe, expect, it } from 'vitest';
import {
  extractBalancedJsonArray,
  parseFlashcardsJson,
  repairTruncatedJsonArray,
} from './flashcard-response-parser';

describe('extractBalancedJsonArray', () => {
  it('extracts the first complete array and ignores later brackets in prose', () => {
    const text = 'note [ignore]\n[{"front":"a","back":"b"}]\nmore [x]';
    expect(extractBalancedJsonArray(text)).toBe('[{"front":"a","back":"b"}]');
  });

  it('returns truncated slice when closing bracket is missing', () => {
    const text = '[{"front":"a","back":"b"}, {"front":"c"';
    expect(extractBalancedJsonArray(text)).toBe(text);
  });
});

describe('repairTruncatedJsonArray', () => {
  it('closes an incomplete final object and array', () => {
    const repaired = repairTruncatedJsonArray(
      '[{"front":"a","back":"b"}, {"front":"c","back":"d"'
    );
    expect(JSON.parse(repaired)).toEqual([
      { front: 'a', back: 'b' },
      { front: 'c', back: 'd' },
    ]);
  });
});

describe('parseFlashcardsJson', () => {
  it('parses a clean JSON array', () => {
    const cards = parseFlashcardsJson(
      '[{"front":"Q","back":"A","description":"d","frontHtml":"<b>Q</b>","backHtml":"<b>A</b>","descriptionHtml":"<p>d</p>"}]'
    );
    expect(cards).toHaveLength(1);
    expect(cards[0].front).toBe('Q');
    expect(cards[0].back).toBe('A');
  });

  it('strips thinking wrappers and code fences', () => {
    const raw = `<mm:think>planning</mm:think>
\`\`\`json
[{"front":"Q","back":"A"}]
\`\`\``;
    const cards = parseFlashcardsJson(raw);
    expect(cards).toEqual([{ front: 'Q', back: 'A' }]);
  });

  it('accepts object wrappers', () => {
    const cards = parseFlashcardsJson(
      '{"flashcards":[{"front":"Q","back":"A"}]}'
    );
    expect(cards).toEqual([{ front: 'Q', back: 'A' }]);
  });

  it('repairs truncated trailing card objects', () => {
    const cards = parseFlashcardsJson(
      '[{"front":"Q1","back":"A1"}, {"front":"Q2","back":"A2"'
    );
    expect(cards).toEqual([
      { front: 'Q1', back: 'A1' },
      { front: 'Q2', back: 'A2' },
    ]);
  });

  it('tolerates backticks inside html fields via sanitizer', () => {
    const cards = parseFlashcardsJson(
      '[{"front":"Q","back":"A","frontHtml":"<code>`x`</code>","backHtml":"<p>A</p>"}]'
    );
    expect(cards[0].frontHtml).toContain('x');
  });
});
