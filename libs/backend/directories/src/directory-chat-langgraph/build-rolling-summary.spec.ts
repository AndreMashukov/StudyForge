import { describe, expect, it } from 'vitest';

import type { DirectoryChatMessage } from '@shared-types';
import { buildRollingSummary } from './build-rolling-summary';

function message(role: 'user' | 'assistant', index: number): DirectoryChatMessage {
  return {
    id: `msg-${index}`,
    role,
    content: `content-${index}`,
    createdAt: new Date().toISOString(),
  };
}

describe('buildRollingSummary', () => {
  it('returns the current summary when message count is at the trigger threshold', () => {
    const messages = Array.from({ length: 12 }, (_, index) =>
      message(index % 2 === 0 ? 'user' : 'assistant', index)
    );

    expect(buildRollingSummary(messages, 'existing-summary')).toBe(
      'existing-summary'
    );
  });

  it('builds a summary from all but the last 8 messages when over the trigger', () => {
    const messages = Array.from({ length: 13 }, (_, index) =>
      message(index % 2 === 0 ? 'user' : 'assistant', index)
    );

    const summary = buildRollingSummary(messages);
    expect(summary).toContain('User: content-0');
    expect(summary).toContain('User: content-4');
    expect(summary).not.toContain('content-5');
  });

  it('truncates long summaries and adds the compression marker', () => {
    const messages = Array.from({ length: 20 }, (_, index) =>
      message('user', index)
    ).map((entry) => ({
      ...entry,
      content: 'x'.repeat(1000),
    }));

    const summary = buildRollingSummary(messages);
    expect(summary).toContain('[Earlier chat compressed]');
    expect(summary?.length).toBeLessThanOrEqual(6030);
  });
});
