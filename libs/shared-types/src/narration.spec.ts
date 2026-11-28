import { describe, expect, it } from 'vitest';
import { parseDocumentBlocks } from './document-blocks';
import {
  buildNarrationScript,
  NARRATION_MAX_PART_CHARS,
  NARRATION_SCRIPT_VERSION,
  narrationScriptVersionFor,
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
    const script = buildNarrationScript('', blocks, 1);
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
    // Not read, but counted against the prose share.
    expect(script.stats.nonProseChars).toBeGreaterThan(0);
    expect(script.stats.proseRatio).toBeLessThan(1);
  });

  it('keeps code and tables inside quotes and list items out of the prose', () => {
    const blocks = parseDocumentBlocks(
      '<blockquote>Explanation.<pre><code>x = 1</code></pre>After.</blockquote><ul><li>Step one<table><tr><td>a</td><td>b</td></tr></table><ul><li>Nested</li></ul></li></ul>',
      'html',
    );
    expect(blocks.map((block) => [block.kind, block.level ?? null])).toEqual([
      ['quote', null],
      ['code', null],
      ['quote', null],
      ['list', 0],
      ['table', null],
      ['list', 1],
    ]);
    const script = buildNarrationScript('', blocks, 1);
    expect(script.segments.map((segment) => segment.text)).toEqual([
      'Explanation.',
      'Code example.',
      'After.',
      'Step one.',
      'Table.',
      'Nested.',
    ]);
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

describe('buildNarrationScript, script version 2', () => {
  const intro = `<p>${sentence}</p>`;

  it('reads a short code block as spoken code with a lead-in', () => {
    const blocks = parseDocumentBlocks(
      `${intro}\n\n\`\`\`python\ndef greet(name):\n    return name.upper()  # shout\n\`\`\`\n\nDone.`,
      'markdown',
    );
    expect(blocks[1]).toMatchObject({ kind: 'code', language: 'python' });
    const script = buildNarrationScript('', blocks, 2);
    expect(
      script.segments.map((segment) => [segment.kind, segment.text]),
    ).toEqual([
      ['prose', sentence.trim()],
      [
        'code',
        'Code example in Python. def greet name. return name dot upper. shout.',
      ],
      ['prose', 'Done.'],
    ]);
  });

  it('starts untagged and unknown-language code with a plain lead-in', () => {
    const blocks = parseDocumentBlocks(
      '<pre><code>x = 1</code></pre><pre><code class="language-elixir">y = 2</code></pre>',
      'html',
    );
    expect(
      buildNarrationScript('', blocks, 2).segments.map((s) => s.text),
    ).toEqual(['Code example. x equals 1.', 'Code example. y equals 2.']);
  });

  it('keeps data blocks and long code as markers', () => {
    const longCode = Array.from(
      { length: 60 },
      (_, index) => `const value${index} = compute(${index});`,
    ).join('\n');
    const blocks = parseDocumentBlocks(
      `${intro}<pre><code class="language-json">{"a": 1}</code></pre>${intro}<table><tr><td>a</td></tr></table><pre><code class="language-ts">${longCode}</code></pre>`,
      'html',
    );
    const script = buildNarrationScript('', blocks, 2);
    expect(
      script.segments.map((segment) => [segment.kind, segment.text]),
    ).toEqual([
      ['prose', sentence.trim()],
      ['marker', 'Code example.'],
      ['prose', sentence.trim()],
      ['marker', 'Table and long code example, see the document.'],
    ]);
  });

  it('speaks inline code and replaces opaque strings in prose and the title', () => {
    const blocks = parseDocumentBlocks(
      '<p>Call <code>getUserById()</code> with 3f2a9c1e-7b4d-4e2a-9c1e-0a1b2c3d4e5f, see https://docs.example.com/x.</p>',
      'html',
    );
    const script = buildNarrationScript('Commit 85a1b7a1', blocks, 2);
    expect(script.segments.map((segment) => segment.text)).toEqual([
      'Commit a hash.',
      'Call get user by id with a UUID, see a link to docs.example.com.',
    ]);
  });

  it('measures prose stats on the text as written, as version 1 does', () => {
    const blocks = parseDocumentBlocks(
      `${intro}<p>Use <code>user.id</code> or 3f2a9c1e-7b4d-4e2a-9c1e-0a1b2c3d4e5f.</p><pre><code>x = 1</code></pre>`,
      'html',
    );
    expect(buildNarrationScript('T', blocks, 2).stats).toEqual(
      buildNarrationScript('T', blocks, 1).stats,
    );
  });

  it('speaks the same text as version 1 when there is no code or opaque string', () => {
    const blocks = parseDocumentBlocks(
      `<h2>Intro</h2>${intro}<ul><li>One</li></ul><table><tr><td>a</td></tr></table>`,
      'html',
    );
    expect(buildNarrationScript('Title', blocks, 2).segments).toEqual(
      buildNarrationScript('Title', blocks, 1).segments,
    );
  });

  it('does not give spoken code to the decision model', () => {
    const blocks = parseDocumentBlocks(
      `${intro}<pre><code>secretFunction()</code></pre>`,
      'html',
    );
    expect(
      sampleNarrationProse(buildNarrationScript('', blocks, 2)),
    ).not.toContain('secret');
  });
});

describe('narrationScriptVersionFor', () => {
  it('pins a narration to its version and uses the current one without a narration', () => {
    expect(narrationScriptVersionFor(null)).toBe(NARRATION_SCRIPT_VERSION);
    expect(narrationScriptVersionFor(undefined)).toBe(NARRATION_SCRIPT_VERSION);
    expect(narrationScriptVersionFor({})).toBe(1);
    expect(narrationScriptVersionFor({ scriptVersion: 1 })).toBe(1);
    expect(narrationScriptVersionFor({ scriptVersion: 2 })).toBe(2);
    expect(narrationScriptVersionFor({ scriptVersion: 99 })).toBe(
      NARRATION_SCRIPT_VERSION,
    );
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
