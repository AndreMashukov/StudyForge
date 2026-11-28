import { describe, expect, it } from 'vitest';
import {
  buildNarrationScript,
  NARRATION_SCHEMA_VERSION,
  parseDocumentBlocks,
  planNarrationParts,
  type NarrationPart,
} from '@shared-types';
import {
  keyNarrationParts,
  narrationContentHash,
  narrationPartKey,
  planNarrationWork,
  remapNarrationParts,
  unpublishedNarrationUploads,
} from './narration-planning';

describe('unpublishedNarrationUploads', () => {
  it('keeps every upload a part refers to and returns the rest once', () => {
    const parts = [
      { storagePath: 'n/a-run1.mp3' },
      { storagePath: undefined },
      { storagePath: 'n/b-run0.mp3' },
    ];
    expect(
      unpublishedNarrationUploads(
        ['n/a-run1.mp3', 'n/c-run1.mp3', 'n/c-run1.mp3'],
        parts,
      ),
    ).toEqual(['n/c-run1.mp3']);
  });

  it('returns every upload when the narration was removed', () => {
    expect(unpublishedNarrationUploads(['n/a.mp3'], [])).toEqual(['n/a.mp3']);
  });
});

const route = { voice: 'Kore', model: 'tts-1' };
const sentence =
  'Routers forward packets between networks along the best path. ';

function html(sections: string[]): string {
  return sections
    .map((body, index) => `<h2>Section ${index + 1}</h2><p>${body}</p>`)
    .join('');
}

function plan(sections: string[], voice = route.voice, model = route.model) {
  const script = buildNarrationScript(
    'Title',
    parseDocumentBlocks(html(sections), 'html'),
  );
  return keyNarrationParts(planNarrationParts(script), voice, model);
}

function readyRecord(
  parts: ReturnType<typeof plan>,
  voice = route.voice,
  model = route.model,
) {
  return {
    voice,
    model,
    schemaVersion: NARRATION_SCHEMA_VERSION,
    parts: parts.map(
      (part): NarrationPart => ({
        index: part.index,
        key: part.key,
        blockStart: part.blockStart,
        blockEnd: part.blockEnd,
        charCount: part.charCount,
        status: 'ready',
        storagePath: `users/u/narrations/d/${part.key}.mp3`,
        sizeBytes: 1000,
      }),
    ),
  };
}

const sections = [
  sentence.repeat(30),
  sentence.repeat(30),
  sentence.repeat(30),
];

describe('narrationPartKey', () => {
  it('changes with the text, voice or model', () => {
    const base = narrationPartKey('Hello.', 'Kore', 'tts-1');
    expect(narrationPartKey('Hello.', 'Kore', 'tts-1')).toBe(base);
    expect(narrationPartKey('Hello!', 'Kore', 'tts-1')).not.toBe(base);
    expect(narrationPartKey('Hello.', 'Puck', 'tts-1')).not.toBe(base);
    expect(narrationPartKey('Hello.', 'Kore', 'tts-2')).not.toBe(base);
  });
});

describe('narrationContentHash', () => {
  it('follows the spoken text, not its spacing', () => {
    const script = (body: string) =>
      buildNarrationScript('T', parseDocumentBlocks(`<p>${body}</p>`, 'html'));
    expect(narrationContentHash(script('One two.'))).toBe(
      narrationContentHash(script('One   two.')),
    );
    expect(narrationContentHash(script('One two.'))).not.toBe(
      narrationContentHash(script('One three.')),
    );
  });

  it('changes when unspoken content the check screens on changes', () => {
    const script = (code: string) =>
      buildNarrationScript(
        'T',
        parseDocumentBlocks(
          `<p>Intro.</p><pre><code>${code}</code></pre>`,
          'html',
        ),
        1,
      );
    // Same spoken text ("Code example."), different amount of code.
    expect(narrationContentHash(script('x = 1'))).not.toBe(
      narrationContentHash(script('x = 1\n'.repeat(400))),
    );
  });
});

describe('script version 1 is frozen', () => {
  // Narrations made before spoken code keep their audio (ADR 020): their
  // content hash and part keys must not change. Values recorded with the
  // pre-ADR-020 builder; if this fails, the version-1 path changed.
  const html = [
    '<h2>Setup</h2>',
    '<p>Install it with <code>npm install</code>, then open https://github.com/org/repo for commit 85a1b7a1 and id 3f2a9c1e-7b4d-4e2a-9c1e-0a1b2c3d4e5f.</p>',
    '<pre><code class="language-ts">const user = getUserById(id);</code></pre>',
    '<table><tr><td>a</td><td>b</td></tr></table>',
    '<p>The handshake confirms both sides can send and receive data.</p>',
  ].join('');
  const script = buildNarrationScript(
    'Guide',
    parseDocumentBlocks(html, 'html'),
    1,
  );

  it('keeps the content hash', () => {
    expect(narrationContentHash(script)).toBe(
      '98c844978b546df546c29ceafdd60c2190a5c6a70053f9cf95d4a48b862422e4',
    );
  });

  it('keeps the part keys', () => {
    expect(
      keyNarrationParts(planNarrationParts(script), 'Kore', 'tts-model').map(
        (part) => part.key,
      ),
    ).toEqual(['7ca2461ba3cfe4ddb7704cf5b08cf028']);
  });
});

describe('planNarrationWork', () => {
  it('generates every part of a new narration and charges for all of it', () => {
    const planned = plan(sections);
    const work = planNarrationWork(planned, null, route);
    expect(work.toGenerate).toHaveLength(planned.length);
    expect(work.parts.every((part) => part.status === 'pending')).toBe(true);
    const chars = planned.reduce((sum, part) => sum + part.charCount, 0);
    expect(work.chargedCharCount).toBe(chars);
    expect(work.creditUnits).toBe(Math.ceil(chars / 1000));
    expect(work.voiceChanged).toBe(false);
  });

  it('regenerates and charges only the parts whose text changed', () => {
    const before = plan(sections);
    const edited = plan([
      sections[0],
      `Changed. ${sentence.repeat(30)}`,
      sections[2],
    ]);
    const work = planNarrationWork(edited, readyRecord(before), route);

    const changed = edited.filter(
      (part) => !before.some((old) => old.key === part.key),
    );
    expect(changed.length).toBeGreaterThan(0);
    expect(changed.length).toBeLessThan(edited.length);
    expect(work.toGenerate.map((part) => part.key)).toEqual(
      changed.map((part) => part.key),
    );
    expect(work.chargedCharCount).toBe(
      changed.reduce((sum, part) => sum + part.charCount, 0),
    );
    expect(work.parts.filter((part) => part.status === 'ready')).toHaveLength(
      edited.length - changed.length,
    );
    expect(
      work.obsolete.every(
        (part) => !edited.some((next) => next.key === part.key),
      ),
    ).toBe(true);
    expect(work.obsolete.length).toBeGreaterThan(0);
  });

  it('charges nothing when every part is already stored', () => {
    const planned = plan(sections);
    const work = planNarrationWork(planned, readyRecord(planned), route);
    expect(work.toGenerate).toHaveLength(0);
    expect(work.creditUnits).toBe(0);
    expect(work.obsolete).toHaveLength(0);
  });

  it('redoes the whole narration after the voice changes', () => {
    const old = plan(sections, 'Puck');
    const planned = plan(sections);
    const work = planNarrationWork(planned, readyRecord(old, 'Puck'), route);
    expect(work.voiceChanged).toBe(true);
    expect(work.toGenerate).toHaveLength(planned.length);
    expect(work.obsolete).toHaveLength(old.length);
  });

  it('retries failed parts', () => {
    const planned = plan(sections);
    const record = readyRecord(planned);
    record.parts[1] = {
      ...record.parts[1],
      status: 'failed',
      storagePath: undefined,
    };
    const work = planNarrationWork(planned, record, route);
    expect(work.toGenerate.map((part) => part.key)).toEqual([planned[1].key]);
  });
});

describe('repeated text', () => {
  it('generates and charges a repeated part once', () => {
    const text = sentence.repeat(20).trim();
    const planned = keyNarrationParts(
      [0, 1].map((index) => ({
        index,
        text,
        blockStart: index,
        blockEnd: index,
        charCount: text.length,
      })),
      route.voice,
      route.model,
    );
    expect(planned[0].key).toBe(planned[1].key);
    const work = planNarrationWork(planned, null, route);
    expect(work.toGenerate).toHaveLength(1);
    expect(work.chargedCharCount).toBe(text.length);
    expect(work.parts).toHaveLength(2);
  });
});

describe('remapNarrationParts', () => {
  it('moves kept parts to their new place and drops changed ones', () => {
    const before = plan(sections);
    const after = plan([`Inserted. ${sentence.repeat(30)}`, ...sections]);
    const { kept, dropped } = remapNarrationParts(
      readyRecord(before).parts,
      after,
    );
    const afterByKey = new Map(after.map((part) => [part.key, part]));
    for (const part of kept) {
      const next = afterByKey.get(part.key);
      expect(next).toBeDefined();
      expect(part.index).toBe(next?.index);
      expect(part.blockStart).toBe(next?.blockStart);
      expect(part.status).toBe('ready');
    }
    expect(kept.length + dropped.length).toBeGreaterThanOrEqual(before.length);
    expect(dropped.every((part) => !afterByKey.has(part.key))).toBe(true);
  });
});
