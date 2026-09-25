const LINE_FORMAT_FENCE_PATTERN = /```line-format\s*\n([\s\S]*?)```/i;

export function rulesTextRequiresLineFormatOutput(rules?: string): boolean {
  if (!rules?.trim()) {
    return false;
  }
  return LINE_FORMAT_FENCE_PATTERN.test(rules);
}

export function extractLineFormatSampleLine(rules?: string): string | null {
  if (!rules?.trim()) {
    return null;
  }
  const match = rules.match(LINE_FORMAT_FENCE_PATTERN);
  if (!match) {
    return null;
  }
  const firstLine = match[1]
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 0);
  return firstLine ?? null;
}

export function buildLineShapeRegex(sampleLine: string): RegExp {
  let pattern = '^';
  let index = 0;
  while (index < sampleLine.length) {
    const char = sampleLine[index];
    if (/[A-Za-z]/.test(char)) {
      pattern += '[^\\s\\[\\]()]+';
      while (index < sampleLine.length && /[A-Za-z]/.test(sampleLine[index])) {
        index += 1;
      }
      continue;
    }
    if (/\d/.test(char)) {
      pattern += '\\d+';
      while (index < sampleLine.length && /\d/.test(sampleLine[index])) {
        index += 1;
      }
      continue;
    }
    pattern += char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    index += 1;
  }
  pattern += '$';
  return new RegExp(pattern);
}

export function lineMatchesSampleShape(line: string, sampleLine: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) {
    return false;
  }
  return buildLineShapeRegex(sampleLine).test(trimmed);
}

export const SEALED_LINE_FORMAT_HTML_OUTPUT_CONTRACT_LINES = [
  '- Output ONLY an HTML fragment — no full documents (<html>, <head>, <body>).',
  '- Output exactly one <pre> block containing the transformed lines and nothing else.',
  '- Do NOT include headings, titles, commentary, lists, tables, or other sections outside that <pre> block.',
  '- Each non-empty line inside the <pre> must follow the line-format sample in the Domain Rules.',
  '- NO wrapper code blocks (do not wrap the entire document in ```html or ```markdown).',
  `- Allowed tags: pre, code.`,
  `- Do NOT include ${['script', 'iframe', 'style', 'link'].map((tag) => `<${tag}>`).join(', ')}.`,
] as const;
