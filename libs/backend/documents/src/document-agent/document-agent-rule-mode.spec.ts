import { describe, expect, it } from 'vitest';
import { resolveDocumentAgentRuleMode } from './document-agent-rule-mode';

describe('resolveDocumentAgentRuleMode', () => {
  it('honors explicit-only even when no rule ids are present', () => {
    expect(
      resolveDocumentAgentRuleMode({
        sourceKind: 'prompt',
        ruleIds: [],
        ruleResolutionMode: 'explicit-only',
      }),
    ).toBe('explicit-only');
  });

  it('falls back to inherit for prompt jobs without a mode', () => {
    expect(
      resolveDocumentAgentRuleMode({
        sourceKind: 'prompt',
      }),
    ).toBe('inherit');
  });

  it('uses explicit-only when rule ids are set and mode is omitted', () => {
    expect(
      resolveDocumentAgentRuleMode({
        sourceKind: 'prompt',
        ruleIds: ['rule-1'],
      }),
    ).toBe('explicit-only');
  });

  it('forces explicit-only for ingest source kinds', () => {
    expect(
      resolveDocumentAgentRuleMode({
        sourceKind: 'upload',
        ruleResolutionMode: 'inherit-plus-explicit',
      }),
    ).toBe('explicit-only');
    expect(
      resolveDocumentAgentRuleMode({
        sourceKind: 'paste',
        ruleIds: ['rule-1'],
      }),
    ).toBe('explicit-only');
  });
});
