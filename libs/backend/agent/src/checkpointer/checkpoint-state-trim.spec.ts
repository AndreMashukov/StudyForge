import { describe, expect, it } from 'vitest';
import {
  CHECKPOINT_MAX_PAST_STEPS,
  CHECKPOINT_MAX_TOOL_OUTCOMES,
  CHECKPOINT_MAX_TOOL_STRING_CHARS,
  mergeCappedPastSteps,
  mergeCappedToolOutcomes,
  trimToolOutcomeForCheckpoint,
} from './checkpoint-state-trim';

describe('checkpoint-state-trim', () => {
  it('truncates long string fields in tool results', () => {
    const longBody = 'x'.repeat(CHECKPOINT_MAX_TOOL_STRING_CHARS + 500);
    const trimmed = trimToolOutcomeForCheckpoint({
      name: 'get_document_content',
      ok: true,
      result: {
        id: 'doc-1',
        title: 'Test',
        content: longBody,
      },
    });

    expect(trimmed.result).toMatchObject({
      id: 'doc-1',
      title: 'Test',
    });
    const content = (trimmed.result as { content: string }).content;
    expect(content.length).toBeLessThan(longBody.length);
    expect(content).toContain('[truncated for checkpoint storage]');
  });

  it('caps merged tool outcomes to the latest entries', () => {
    const first = Array.from({ length: CHECKPOINT_MAX_TOOL_OUTCOMES }, (_, i) => ({
      name: 'list_documents',
      ok: true as const,
      result: [{ id: `doc-${i}` }],
    }));
    const merged = mergeCappedToolOutcomes(first, [
      { name: 'create_document', ok: true, result: { id: 'new-doc' } },
    ]);

    expect(merged).toHaveLength(CHECKPOINT_MAX_TOOL_OUTCOMES);
    expect(merged.at(-1)).toMatchObject({
      name: 'create_document',
      result: { id: 'new-doc' },
    });
  });

  it('caps merged past steps', () => {
    const steps = Array.from({ length: CHECKPOINT_MAX_PAST_STEPS + 2 }, (_, i) => ({
      step: `Step ${i}`,
      result: `Result ${i}`,
    }));
    const merged = mergeCappedPastSteps(steps.slice(0, -1), [steps.at(-1)!]);

    expect(merged).toHaveLength(CHECKPOINT_MAX_PAST_STEPS);
    expect(merged.at(-1)?.step).toBe(`Step ${CHECKPOINT_MAX_PAST_STEPS + 1}`);
  });
});
