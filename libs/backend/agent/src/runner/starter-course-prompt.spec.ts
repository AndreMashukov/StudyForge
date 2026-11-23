import { describe, expect, it } from 'vitest';
import { buildStarterCoursePromptBlock } from './starter-course-prompt';

describe('buildStarterCoursePromptBlock', () => {
  it('tells the agent to build the course without asking for approval', () => {
    const block = buildStarterCoursePromptBlock({
      sampleDirectoryId: 'sample-dir',
      documentsRemaining: 2,
    });
    expect(block).toContain('STARTER COURSE MODE');
    expect(block).toContain('without asking for approval');
    expect(block).toContain('parentId "root"');
    expect(block).toContain('create_document exactly 2 times');
    expect(block).toContain('Never ask a second time');
    expect(block).toContain('sample folder (id: sample-dir)');
    expect(block).toContain('Free documents left in this course: 2');
    expect(block).not.toContain('already exists');
  });

  it('reuses a course folder from an earlier turn', () => {
    const block = buildStarterCoursePromptBlock({
      courseDirectoryId: 'course-dir',
      documentsRemaining: 1,
    });
    expect(block).toContain('course folder already exists (id: course-dir)');
    expect(block).toContain('Free documents left in this course: 1');
    expect(block).not.toContain('sample folder (id:');
  });
});
