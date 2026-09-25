import { describe, expect, it } from 'vitest';
import { validateLineFormatOutput } from './line-format-validator';

const LINE_FORMAT_RULE = {
  name: 'Mandarin Text Transform',
  content: [
    'Transform each word.',
    '',
    '```line-format',
    '[word] (part-part-42)',
    '```',
  ].join('\n'),
};

describe('validateLineFormatOutput', () => {
  it('passes a single pre block with matching lines', () => {
    const html = `<pre>[dog] (gou-dog-3)
[cat] (mao-cat-1)</pre>`;
    const findings = validateLineFormatOutput(html, [LINE_FORMAT_RULE]);
    expect(findings).toHaveLength(0);
  });

  it('flags extra sections outside the pre block', () => {
    const html = `<h2>Title</h2><pre>[dog] (gou-dog-3)</pre>`;
    const findings = validateLineFormatOutput(html, [LINE_FORMAT_RULE]);
    expect(findings.some((f) => f.code === 'LINE_FORMAT_NO_EXTRA_SECTIONS')).toBe(
      true,
    );
  });

  it('flags lines that do not match the sample shape', () => {
    const html = `<pre>[dog] gou-dog-3</pre>`;
    const findings = validateLineFormatOutput(html, [LINE_FORMAT_RULE]);
    expect(findings.some((f) => f.code === 'LINE_FORMAT_SHAPE_MISMATCH')).toBe(
      true,
    );
  });

  it('skips validation when no line-format fence is present', () => {
    const html = '<p>Hello</p>';
    const findings = validateLineFormatOutput(html, [
      { name: 'Doc HTML Format', content: 'Use headings and paragraphs.' },
    ]);
    expect(findings).toHaveLength(0);
  });
});
