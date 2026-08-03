export type ValidationSeverity = 'error' | 'warning';

export type ValidationCategory =
  | 'html'
  | 'security'
  | 'format'
  | 'mermaid'
  | 'plotly'
  | 'rules'
  | 'empty';

export interface ValidationFinding {
  severity: ValidationSeverity;
  code: string;
  category: ValidationCategory;
  message: string;
  pathOrSnippet?: string;
  repairHint?: string;
}

export interface ValidationReport {
  passed: boolean;
  findings: ValidationFinding[];
  errorCount: number;
  warningCount: number;
}

export interface DocumentRule {
  name: string;
  content: string;
}

export function createValidationReport(findings: ValidationFinding[]): ValidationReport {
  const errorCount = findings.filter((finding) => finding.severity === 'error').length;
  const warningCount = findings.filter((finding) => finding.severity === 'warning').length;

  return {
    passed: errorCount === 0,
    findings,
    errorCount,
    warningCount,
  };
}

export function formatValidationFindings(findings: ValidationFinding[]): string {
  if (findings.length === 0) {
    return 'No validation issues found.';
  }

  return findings
    .map((finding, index) => {
      const location = finding.pathOrSnippet ? ` at ${finding.pathOrSnippet}` : '';
      const hint = finding.repairHint ? ` Hint: ${finding.repairHint}` : '';
      return `${index + 1}. [${finding.severity.toUpperCase()}][${finding.code}] ${finding.message}${location}.${hint}`;
    })
    .join('\n');
}

export function mergeValidationReports(
  base: ValidationReport,
  additional: ValidationReport
): ValidationReport {
  const findings = [...base.findings, ...additional.findings];
  return createValidationReport(findings);
}
