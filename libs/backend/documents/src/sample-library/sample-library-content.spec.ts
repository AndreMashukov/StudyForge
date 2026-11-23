import { describe, expect, it } from 'vitest';
import { prepareHtmlDocumentForStorage } from '../document-html';
import {
  SAMPLE_LIBRARY_DIRECTORY,
  SAMPLE_LIBRARY_DOCUMENTS,
  SAMPLE_LIBRARY_QUIZ,
} from './sample-library-content';

describe('sample library content', () => {
  it('has a folder name the directory rules accept', () => {
    expect(SAMPLE_LIBRARY_DIRECTORY.name).not.toMatch(/[/\\:*?"<>|]/);
    expect(SAMPLE_LIBRARY_DIRECTORY.description).toMatch(/safe to delete/);
  });

  it.each(SAMPLE_LIBRARY_DOCUMENTS)(
    'stores "$title" as a valid HTML document',
    async (sample) => {
      const prepared = await prepareHtmlDocumentForStorage(
        sample.html,
        sample.title,
      );
      expect(prepared.wordCount).toBeGreaterThan(150);
      expect(prepared.fullHtml).toContain(sample.title);
    },
  );

  it('has a quiz whose answers point at real options', () => {
    expect(SAMPLE_LIBRARY_QUIZ.questions.length).toBeGreaterThanOrEqual(5);
    for (const question of SAMPLE_LIBRARY_QUIZ.questions) {
      expect(question.options).toHaveLength(4);
      expect(question.correctAnswer).toBeGreaterThanOrEqual(0);
      expect(question.correctAnswer).toBeLessThan(question.options.length);
    }
  });
});
