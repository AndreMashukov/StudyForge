import { describe, expect, it } from 'vitest';
import {
  buildLineShapeRegex,
  extractLineFormatSampleLine,
  lineMatchesSampleShape,
  rulesTextRequiresLineFormatOutput,
} from './line-format-contract';

describe('line-format-contract', () => {
  const rules = [
    '# Transform',
    '',
    '```line-format',
    '[word] (part-part-42)',
    '```',
  ].join('\n');

  it('detects line-format fences in rules text', () => {
    expect(rulesTextRequiresLineFormatOutput(rules)).toBe(true);
    expect(extractLineFormatSampleLine(rules)).toBe('[word] (part-part-42)');
  });

  it('builds a regex that accepts transformed lines', () => {
    expect(lineMatchesSampleShape('[dog] (gou-dog-3)', '[word] (part-part-42)')).toBe(
      true,
    );
    expect(
      lineMatchesSampleShape('[元朗] (yuan-yuan-lang-lang-02)', '[word] (part-part-42)'),
    ).toBe(true);
    expect(lineMatchesSampleShape('[dog] gou-dog-3', '[word] (part-part-42)')).toBe(
      false,
    );
  });

  it('treats letter and digit runs in the sample as wildcards', () => {
    const regex = buildLineShapeRegex('[word] (part-part-42)');
    expect(regex.test('[dog] (gou-dog-3)')).toBe(true);
    expect(regex.test('[dog] (gou-dog)')).toBe(false);
  });
});
