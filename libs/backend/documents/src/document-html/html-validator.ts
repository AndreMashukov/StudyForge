import { HtmlValidate } from 'html-validate';
import type { ValidationFinding } from './types';

const htmlValidator = new HtmlValidate({
  extends: ['html-validate:recommended'],
  rules: {
    'no-inline-style': 'error',
    'script-type': 'error',
    'void-style': 'off',
    // Cosmetic; also stripped in normalizeGeneratedHtmlFragment.
    'no-trailing-whitespace': 'off',
    'no-raw-characters': 'warn',
  },
});

export function wrapFragmentForValidation(htmlFragment: string): string {
  return `<!DOCTYPE html><html lang="en"><head><title>Validation</title></head><body>${htmlFragment}</body></html>`;
}

export async function validateHtmlStructure(htmlFragment: string): Promise<ValidationFinding[]> {
  const findings: ValidationFinding[] = [];
  const wrapped = wrapFragmentForValidation(htmlFragment);
  const report = await htmlValidator.validateString(wrapped);

  for (const result of report.results) {
    for (const message of result.messages) {
      if (message.severity === 1 || message.severity === 2) {
        findings.push({
          severity: message.severity === 2 ? 'error' : 'warning',
          code: `HTML_${message.ruleId ?? 'VALIDATION'}`,
          category: 'html',
          message: message.message,
          pathOrSnippet:
            message.line !== undefined
              ? `line ${message.line}, col ${message.column ?? 0}`
              : undefined,
          repairHint: 'Fix the HTML structure so it passes HTML5 validation.',
        });
      }
    }
  }

  return findings;
}
