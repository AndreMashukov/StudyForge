import { describe, expect, it } from 'vitest';
import { formatUsagePlanLabel } from './usagePlanLabel';

describe('formatUsagePlanLabel', () => {
  it('uses the live usage limits setup name', () => {
    expect(formatUsagePlanLabel('Power')).toBe('Power plan');
    expect(formatUsagePlanLabel('Free')).toBe('Free plan');
  });

  it('does not duplicate an existing plan suffix', () => {
    expect(formatUsagePlanLabel('Default plan')).toBe('Default plan');
  });

  it('omits a label when the setup name is missing', () => {
    expect(formatUsagePlanLabel(undefined)).toBeUndefined();
    expect(formatUsagePlanLabel('   ')).toBeUndefined();
  });
});
