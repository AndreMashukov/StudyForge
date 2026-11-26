import { describe, expect, it } from 'vitest';
import { resolveAgentThreadHomeDirectoryId } from './agent';

describe('resolveAgentThreadHomeDirectoryId', () => {
  it('uses the directory a chat was started from', () => {
    expect(
      resolveAgentThreadHomeDirectoryId({ type: 'directory', directoryId: 'dir-1' }),
    ).toBe('dir-1');
  });

  it('gives document, rule and no-context chats no home folder', () => {
    expect(
      resolveAgentThreadHomeDirectoryId({
        type: 'document',
        documentId: 'doc-1',
        directoryId: 'dir-1',
      }),
    ).toBeUndefined();
    expect(
      resolveAgentThreadHomeDirectoryId({ type: 'rule', ruleId: 'rule-1' }),
    ).toBeUndefined();
    expect(resolveAgentThreadHomeDirectoryId(undefined)).toBeUndefined();
  });
});
