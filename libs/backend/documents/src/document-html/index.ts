import {
  createValidationReport,
  mergeValidationReports,
  type DocumentRule,
  type ValidationReport,
} from './types';
import { validateHtmlStructure } from './html-validator';
import { validateMermaidBlocks } from './mermaid-validator';
import { normalizeGeneratedHtmlFragment } from './normalize-html';
import { validatePlotlyBlocks } from './plotly-validator';
import {
  validateAllowedTags,
  validateNonEmpty,
  validateSecurity,
} from './security-validator';
import {
  countWordsFromContent,
  extractBodyHtml,
  wrapHtmlDocument,
} from './html-utils';

export async function validateDocumentHtml(
  htmlFragment: string,
  _rules: DocumentRule[] = []
): Promise<ValidationReport> {
  const normalized = normalizeGeneratedHtmlFragment(htmlFragment);
  const findings = [
    ...validateNonEmpty(normalized),
    ...validateSecurity(normalized),
    ...validateAllowedTags(normalized),
    ...validateMermaidBlocks(normalized),
    ...validatePlotlyBlocks(normalized),
    ...(await validateHtmlStructure(normalized)),
  ];

  return createValidationReport(findings);
}

export async function prepareHtmlDocumentForStorage(
  content: string,
  title: string
): Promise<{ fullHtml: string; wordCount: number }> {
  const normalized = normalizeGeneratedHtmlFragment(content);
  const fragment =
    /<html[\s>]/i.test(normalized) || /<body[\s>]/i.test(normalized)
      ? extractBodyHtml(normalized)
      : normalized;

  const report = await validateDocumentHtml(fragment);
  if (!report.passed) {
    const errors = report.findings
      .filter((finding) => finding.severity === 'error')
      .map((finding) => finding.message)
      .join('; ');
    throw new Error(`Invalid HTML document content: ${errors}`);
  }

  const fullHtml = wrapHtmlDocument(fragment, title);
  return {
    fullHtml,
    wordCount: countWordsFromContent(fullHtml, 'html'),
  };
}

export { mergeValidationReports };
export * from './types';
export * from './html-utils';
export * from './html-validator';
export * from './normalize-html';
export * from './security-validator';
export * from './mermaid-validator';
export * from './plotly-validator';
