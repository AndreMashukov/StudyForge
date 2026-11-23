import { describe, expect, it } from 'vitest';
import { buildStarterCoursePromptBlock } from './starter-course-prompt';

describe('buildStarterCoursePromptBlock', () => {
  it('asks clarifying questions first and builds nothing', () => {
    const block = buildStarterCoursePromptBlock({
      phase: 'ask',
      sampleDirectoryId: 'sample-dir',
      documentsRemaining: 2,
    });
    expect(block).toContain('STEP 1 OF 2: ASK');
    expect(block).toContain('"questions" array of 2 or 3 questions');
    expect(block).toContain('do not call any tools');
    expect(block).toContain('"recommended": true');
    expect(block).not.toContain('create_document exactly');
  });

  it('builds from the answers without asking again', () => {
    const block = buildStarterCoursePromptBlock({
      phase: 'build',
      sampleDirectoryId: 'sample-dir',
      documentsRemaining: 2,
    });
    expect(block).toContain('STEP 2 OF 2: BUILD');
    expect(block).toContain('Do not ask any more questions');
    expect(block).toContain('parentId "root"');
    expect(block).toContain('create_document exactly 2 times');
    expect(block).toContain('sample folder (id: sample-dir)');
    expect(block).toContain('Free documents left in this course: 2');
  });

  it('reuses a course folder from an earlier turn', () => {
    const block = buildStarterCoursePromptBlock({
      phase: 'build',
      courseDirectoryId: 'course-dir',
      documentsRemaining: 1,
    });
    expect(block).toContain('course folder already exists (id: course-dir)');
    expect(block).toContain('create_document exactly 1 time ');
    expect(block).not.toContain('parentId "root"');
  });

  it('recreates failed documents on a retry', () => {
    const block = buildStarterCoursePromptBlock({
      phase: 'build',
      courseDirectoryId: 'course-dir',
      documentsRemaining: 2,
      isRetry: true,
    });
    expect(block).toContain('RETRY: every document you started');
    expect(block).toContain('course folder already exists (id: course-dir)');
    expect(block).toContain('create_document exactly 2 times');
  });
});
