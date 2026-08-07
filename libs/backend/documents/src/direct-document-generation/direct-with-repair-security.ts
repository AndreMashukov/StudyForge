import type { ValidationFinding, ValidationReport } from '../document-html/types';

const HARD_SECURITY_CODES = new Set([
  'SECURITY_DISALLOWED_TAG',
  'SECURITY_EVENT_HANDLER',
  'FORMAT_DISALLOWED_ATTRIBUTE',
]);

export function isHardSecurityFinding(finding: ValidationFinding): boolean {
  return finding.category === 'security' || HARD_SECURITY_CODES.has(finding.code);
}

export function getHardSecurityFindings(report: ValidationReport): ValidationFinding[] {
  return report.findings.filter(
    (finding) => finding.severity === 'error' && isHardSecurityFinding(finding)
  );
}
