import { describe, expect, it } from 'vitest';
import { parseDocumentBlocks } from './document-blocks';
import {
  buildNarrationScript,
  NARRATION_MAX_PART_CHARS,
  NARRATION_TARGET_PART_CHARS,
  narrationCreditUnits,
  planNarrationParts,
  sampleNarrationProse,
  screenNarrationScript,
  summarizeNarrationStatus,
  type NarrationPart,
} from './narration';

const sentence =
  'The handshake confirms both sides can send and receive data. ';

function paragraphs(count: number, sentencesEach = 4): string {
  return Array.from(
    { length: count },
    (_, index) =>
      `<p>Paragraph ${index + 1}. ${sentence.repeat(sentencesEach)}</p>`,
  ).join('');
}

describe('buildNarrationScript', () => {
  it('reads the title, headings, prose and list items in order with pauses', () => {
    const blocks = parseDocumentBlocks(
      '<h1>Networking</h1><p>Packets travel through <a href="https://x.test">routers</a> and <code>switches</code>.</p><ul><li>First hop</li></ul>',
      'html',
    );
    const script = buildNarrationScript('TCP basics', blocks);
    expect(script.segments.map((segment) => segment.text)).toEqual([
      'TCP basics.',
      'Networking.',
      'Packets travel through routers and switches.',
      'First hop.',
    ]);
    expect(script.segments[0].blockIndex).toBe(0);
    expect(JSON.stringify(script)).not.toContain('https://x.test');
  });

  it('replaces each run of unspoken blocks with one marker', () => {
    const blocks = parseDocumentBlocks(
      '<p>The exchange looks like this:</p><pre><code class="language-mermaid">graph TD</code></pre><table><tr><td>a</td><td>b</td></tr><tr><td>c</td><td>d</td></tr></table><pre><code>x = 1</code></pre><p>Then it continues.</p><img src="https://x.test/a.png" alt="A router">',
      'html',
    );
    const script = buildNarrationScript('', blocks);
    expect(
      script.segments.map((segment) => [segment.kind, segment.text]),
    ).toEqual([
      ['prose', 'The exchange looks like this:'],
      ['marker', 'Diagram, table and code example.'],
      ['prose', 'Then it continues.'],
      ['marker', 'Image: A router.'],
    ]);
  });

  it('never reads inline placeholders for embedded content', () => {
    const blocks = parseDocumentBlocks('<p>Look <svg></svg> here.</p>', 'html');
    const script = buildNarrationScript('', blocks);
    expect(script.segments[0].text).toBe('Look here.');
  });

  it('measures prose against code and tables', () => {
    const blocks = parseDocumentBlocks(
      `<p>Short intro.</p><pre><code>${'x'.repeat(500)}</code></pre>`,
      'html',
    );
    const script = buildNarrationScript('', blocks);
    expect(script.stats.proseChars).toBe('Short intro.'.length);
    expect(script.stats.proseRatio).toBeLessThan(0.1);
  });
});

describe('screenNarrationScript', () => {
  it('rejects documents with too little prose without a model', () => {
    const script = buildNarrationScript(
      '',
      parseDocumentBlocks('<p>Hi there.</p>', 'html'),
    );
    expect(screenNarrationScript(script)).toEqual({
      outcome: 'notNarratable',
      reason: 'tooLittleProse',
    });
  });

  it('rejects documents that are mostly code', () => {
    const html = `${paragraphs(2)}<pre><code>${'let a = 1;\n'.repeat(200)}</code></pre>`;
    const script = buildNarrationScript('', parseDocumentBlocks(html, 'html'));
    expect(screenNarrationScript(script)).toEqual({
      outcome: 'notNarratable',
      reason: 'mostlyNonProse',
    });
  });

  it('rejects documents too long to narrate', () => {
    const script = buildNarrationScript(
      '',
      parseDocumentBlocks(paragraphs(300), 'html'),
    );
    expect(screenNarrationScript(script)).toEqual({
      outcome: 'notNarratable',
      reason: 'tooLong',
    });
  });

  it('sends prose documents to the decision model', () => {
    const script = buildNarrationScript(
      '',
      parseDocumentBlocks(paragraphs(5), 'html'),
    );
    expect(screenNarrationScript(script)).toEqual({ outcome: 'judge' });
  });
});

describe('sampleNarrationProse', () => {
  it('keeps short documents whole and samples long ones from three places', () => {
    const short = buildNarrationScript(
      '',
      parseDocumentBlocks(paragraphs(2), 'html'),
    );
    expect(sampleNarrationProse(short)).not.toContain('…');

    const long = buildNarrationScript(
      '',
      parseDocumentBlocks(paragraphs(60), 'html'),
    );
    const sample = sampleNarrationProse(long, 3_000);
    expect(sample.length).toBeLessThanOrEqual(3_000 + 20);
    expect(sample).toContain('Paragraph 1.');
    expect(sample).toContain('Paragraph 60.');
  });
});

describe('planNarrationParts', () => {
  it('cuts at block boundaries near the target length and covers every segment', () => {
    const script = buildNarrationScript(
      'Title',
      parseDocumentBlocks(paragraphs(40), 'html'),
    );
    const parts = planNarrationParts(script);
    expect(parts.length).toBeGreaterThan(3);
    for (const part of parts) {
      expect(part.charCount).toBeLessThanOrEqual(NARRATION_MAX_PART_CHARS);
      expect(part.text.length).toBe(part.charCount);
    }
    const spoken = parts.map((part) => part.text).join('\n\n');
    for (const segment of script.segments)
      expect(spoken).toContain(segment.text);
    expect(parts.map((part) => part.index)).toEqual(
      parts.map((_, index) => index),
    );
    for (let index = 1; index < parts.length; index += 1) {
      expect(parts[index].blockStart).toBeGreaterThanOrEqual(
        parts[index - 1].blockEnd,
      );
    }
  });

  it('starts a new part at a section heading once the part is half full', () => {
    const html = `${paragraphs(4)}<h2>Second section</h2>${paragraphs(2)}`;
    const script = buildNarrationScript('', parseDocumentBlocks(html, 'html'));
    const parts = planNarrationParts(script);
    const headingPart = parts.find((part) =>
      part.text.startsWith('Second section.'),
    );
    expect(headingPart).toBeDefined();
    expect(parts[0].charCount).toBeGreaterThanOrEqual(
      NARRATION_TARGET_PART_CHARS / 2,
    );
  });

  it('cuts one very long paragraph at sentence ends', () => {
    const html = `<p>${sentence.repeat(120)}</p>`;
    const script = buildNarrationScript('', parseDocumentBlocks(html, 'html'));
    const parts = planNarrationParts(script);
    expect(parts.length).toBeGreaterThan(1);
    for (const part of parts) {
      expect(part.charCount).toBeLessThanOrEqual(NARRATION_MAX_PART_CHARS);
      expect(part.text.endsWith('.')).toBe(true);
      expect(part.blockStart).toBe(0);
      expect(part.blockEnd).toBe(0);
    }
  });

  it('gives an identical plan for identical input', () => {
    const html = paragraphs(20);
    const first = planNarrationParts(
      buildNarrationScript('T', parseDocumentBlocks(html, 'html')),
    );
    const second = planNarrationParts(
      buildNarrationScript('T', parseDocumentBlocks(html, 'html')),
    );
    expect(second).toEqual(first);
  });
});

describe('narration charging and status', () => {
  it('charges per started 1,000 characters', () => {
    expect(narrationCreditUnits(0)).toBe(0);
    expect(narrationCreditUnits(1)).toBe(1);
    expect(narrationCreditUnits(1_000)).toBe(1);
    expect(narrationCreditUnits(1_001)).toBe(2);
  });

  it('summarizes part statuses', () => {
    const part = (status: NarrationPart['status']): NarrationPart => ({
      index: 0,
      key: 'k',
      blockStart: 0,
      blockEnd: 0,
      charCount: 10,
      status,
    });
    expect(summarizeNarrationStatus([part('ready'), part('pending')])).toBe(
      'generating',
    );
    expect(summarizeNarrationStatus([part('ready'), part('ready')])).toBe(
      'ready',
    );
    expect(summarizeNarrationStatus([part('ready'), part('failed')])).toBe(
      'partial',
    );
    expect(summarizeNarrationStatus([part('failed')])).toBe('failed');
  });
});
