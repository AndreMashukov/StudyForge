import type { IDocumentBlock } from './documentBlocks';
import type { IMobileScratchPad } from './libraryData';

export type IReaderEntry =
  | { kind: 'block'; block: IDocumentBlock }
  | { kind: 'scratchPad'; pad: IMobileScratchPad };

function blockText(block: IDocumentBlock): string {
  return block.spans
    .map((span) => span.text)
    .join('')
    .trim()
    .toLocaleLowerCase();
}

/**
 * Put each scratch pad at the end of its lesson section (the h2 it belongs to),
 * matched by heading text. Pads whose heading is not found go at the end.
 */
export function placeScratchPads(
  blocks: IDocumentBlock[],
  pads: IMobileScratchPad[] | undefined,
): IReaderEntry[] {
  if (!pads?.length) return blocks.map((block) => ({ kind: 'block', block }));
  const byHeading = new Map(
    pads.map((pad) => [pad.heading.trim().toLocaleLowerCase(), pad]),
  );
  const placed = new Set<IMobileScratchPad>();
  const entries: IReaderEntry[] = [];
  let pending: IMobileScratchPad | null = null;

  const flush = () => {
    if (pending) {
      entries.push({ kind: 'scratchPad', pad: pending });
      placed.add(pending);
      pending = null;
    }
  };

  for (const block of blocks) {
    const isSection = block.kind === 'heading' && (block.level ?? 1) <= 2;
    if (isSection) {
      flush();
      pending = byHeading.get(blockText(block)) ?? null;
    }
    entries.push({ kind: 'block', block });
  }
  flush();
  for (const pad of [...pads].sort((a, b) => a.sectionIndex - b.sectionIndex)) {
    if (!placed.has(pad)) entries.push({ kind: 'scratchPad', pad });
  }
  return entries;
}
