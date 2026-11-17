import { describe, expect, it } from 'vitest';
import type { IDocumentBlock } from './documentBlocks';
import { placeScratchPads } from './scratchPadPlacement';

const heading = (text: string, level = 2): IDocumentBlock => ({
  kind: 'heading',
  level,
  spans: [{ text }],
});
const paragraph = (text: string): IDocumentBlock => ({
  kind: 'paragraph',
  spans: [{ text }],
});
const pad = (sectionIndex: number, title: string) => ({
  sectionIndex,
  heading: title,
  question: `Q${sectionIndex}`,
  answer: `A${sectionIndex}`,
});

describe('placeScratchPads', () => {
  it('places each pad at the end of its section, before the next h2', () => {
    const entries = placeScratchPads(
      [
        heading('Overview'),
        paragraph('a'),
        heading('ATP synthase'),
        paragraph('b'),
      ],
      [pad(0, 'Overview'), pad(1, 'ATP synthase')],
    );
    expect(
      entries.map((entry) =>
        entry.kind === 'block'
          ? entry.block.spans[0]?.text
          : entry.pad.question,
      ),
    ).toEqual(['Overview', 'a', 'Q0', 'ATP synthase', 'b', 'Q1']);
  });

  it('appends pads whose heading is not in the document', () => {
    const entries = placeScratchPads(
      [heading('Intro'), paragraph('a')],
      [pad(3, 'Missing section')],
    );
    expect(entries.at(-1)).toEqual({
      kind: 'scratchPad',
      pad: pad(3, 'Missing section'),
    });
  });

  it('does not split on h3 subsections', () => {
    const entries = placeScratchPads(
      [heading('Overview'), heading('Detail', 3), paragraph('a')],
      [pad(0, 'Overview')],
    );
    expect(entries.at(-1)).toEqual({
      kind: 'scratchPad',
      pad: pad(0, 'Overview'),
    });
  });
});
