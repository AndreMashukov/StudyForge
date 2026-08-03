import {
  ALLOWED_HTML_TAGS,
  DISALLOWED_EVENT_HANDLER_PREFIX,
  DISALLOWED_HTML_ATTRIBUTES,
  DISALLOWED_HTML_TAGS,
  WRAPPER_HTML_TAGS,
} from '@shared-types';
import type { ValidationFinding } from './types';

const ALLOWED_TAG_SET = new Set(ALLOWED_HTML_TAGS.map((tag) => tag.toLowerCase()));

export function validateSecurity(htmlFragment: string): ValidationFinding[] {
  const findings: ValidationFinding[] = [];

  for (const tag of DISALLOWED_HTML_TAGS) {
    const pattern = new RegExp(`<\\s*${tag}\\b[^>]*>`, 'gi');
    if (pattern.test(htmlFragment)) {
      findings.push({
        severity: 'error',
        code: 'SECURITY_DISALLOWED_TAG',
        category: 'security',
        message: `Disallowed tag <${tag}> is not permitted`,
        pathOrSnippet: `<${tag}>`,
        repairHint: `Remove all <${tag}> elements from the HTML fragment.`,
      });
    }
  }

  for (const tag of WRAPPER_HTML_TAGS) {
    const pattern = new RegExp(`<\\/?\\s*${tag}\\b[^>]*>`, 'gi');
    if (pattern.test(htmlFragment)) {
      findings.push({
        severity: 'error',
        code: 'FORMAT_WRAPPER_TAG',
        category: 'format',
        message: `Wrapper tag <${tag}> must not appear in HTML fragments`,
        pathOrSnippet: `<${tag}>`,
        repairHint: 'Return only the body content without html/head/body wrappers.',
      });
    }
  }

  const eventHandlerPattern = new RegExp(
    `\\s${DISALLOWED_EVENT_HANDLER_PREFIX}[a-z]+\\s*=`,
    'gi'
  );
  if (eventHandlerPattern.test(htmlFragment)) {
    findings.push({
      severity: 'error',
      code: 'SECURITY_EVENT_HANDLER',
      category: 'security',
      message: 'Event handler attributes are not permitted',
      repairHint: 'Remove all onclick/onload and similar attributes.',
    });
  }

  for (const attribute of DISALLOWED_HTML_ATTRIBUTES) {
    const pattern = new RegExp(`\\s${attribute}\\s*=`, 'gi');
    if (pattern.test(htmlFragment)) {
      findings.push({
        severity: 'error',
        code: 'FORMAT_DISALLOWED_ATTRIBUTE',
        category: 'format',
        message: `Inline ${attribute} attributes are not permitted`,
        repairHint: `Remove all ${attribute} attributes from elements.`,
      });
    }
  }

  if (/```(?:html|markdown)?/i.test(htmlFragment)) {
    findings.push({
      severity: 'error',
      code: 'FORMAT_CODE_FENCE',
      category: 'format',
      message: 'Markdown or HTML code fences must not wrap the document output',
      repairHint: 'Return raw HTML only, without ``` fences.',
    });
  }

  return findings;
}

export function validateAllowedTags(htmlFragment: string): ValidationFinding[] {
  const findings: ValidationFinding[] = [];
  const tagPattern = /<\/?([a-zA-Z][\w:-]*)\b/g;
  const seen = new Set<string>();

  for (const match of htmlFragment.matchAll(tagPattern)) {
    const tagName = match[1]?.toLowerCase();
    if (!tagName || seen.has(tagName) || ALLOWED_TAG_SET.has(tagName)) {
      if (tagName) {
        seen.add(tagName);
      }
      continue;
    }

    seen.add(tagName);
    findings.push({
      severity: 'error',
      code: 'FORMAT_DISALLOWED_TAG',
      category: 'format',
      message: `Tag <${tagName}> is not in the allowed tag list`,
      pathOrSnippet: `<${tagName}>`,
      repairHint: `Use only allowed tags: ${ALLOWED_HTML_TAGS.join(', ')}.`,
    });
  }

  return findings;
}

export function validateNonEmpty(htmlFragment: string): ValidationFinding[] {
  if (!htmlFragment.trim()) {
    return [
      {
        severity: 'error',
        code: 'EMPTY_CONTENT',
        category: 'empty',
        message: 'Generated HTML fragment is empty',
        repairHint: 'Generate meaningful HTML content that addresses the user request.',
      },
    ];
  }

  return [];
}
