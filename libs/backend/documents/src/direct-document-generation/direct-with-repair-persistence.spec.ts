import { describe, expect, it } from 'vitest';
import {
  getHardSecurityFindings,
  isHardSecurityFinding,
} from './direct-with-repair-security';
import { createValidationReport, type ValidationFinding } from '../document-html/types';

function finding(
  overrides: Partial<ValidationFinding> & Pick<ValidationFinding, 'code' | 'category'>
): ValidationFinding {
  return {
    severity: 'error',
    message: 'test',
    ...overrides,
  };
}

describe('direct-with-repair security gating', () => {
  it('treats security category and blocked attribute codes as hard security', () => {
    expect(
      isHardSecurityFinding(
        finding({ code: 'SECURITY_DISALLOWED_TAG', category: 'security' })
      )
    ).toBe(true);
    expect(
      isHardSecurityFinding(
        finding({ code: 'FORMAT_DISALLOWED_ATTRIBUTE', category: 'format' })
      )
    ).toBe(true);
    expect(
      isHardSecurityFinding(
        finding({ code: 'FORMAT_DISALLOWED_TAG', category: 'format' })
      )
    ).toBe(false);
    expect(
      isHardSecurityFinding(
        finding({ code: 'MERMAID_INVALID_LABEL', category: 'mermaid' })
      )
    ).toBe(false);
  });

  it('collects only hard security errors from a validation report', () => {
    const report = createValidationReport([
      finding({ code: 'FORMAT_DISALLOWED_TAG', category: 'format' }),
      finding({ code: 'SECURITY_EVENT_HANDLER', category: 'security' }),
      finding({
        code: 'FORMAT_WRAPPER_TAG',
        category: 'format',
        severity: 'warning',
      }),
    ]);

    const hard = getHardSecurityFindings(report);
    expect(hard).toHaveLength(1);
    expect(hard[0]?.code).toBe('SECURITY_EVENT_HANDLER');
  });
});
