import type { IDocumentBlock } from './documentBlocks';
import type { IMobileScratchPad } from './libraryData';

export type IReaderEntry =
  /** `blockIndex` is the block's position in the document; narration parts refer to it. */
  | { kind: 'block'; block: IDocumentBlock; blockIndex: number }
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
  if (!pads?.length) {
    return blocks.map((block, blockIndex) => ({
      kind: 'block',
      block,
      blockIndex,
    }));
  }
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

  for (const [blockIndex, block] of blocks.entries()) {
    const isSection = block.kind === 'heading' && (block.level ?? 1) <= 2;
    if (isSection) {
      flush();
      pending = byHeading.get(blockText(block)) ?? null;
    }
    entries.push({ kind: 'block', block, blockIndex });
  }
  flush();
  for (const pad of [...pads].sort((a, b) => a.sectionIndex - b.sectionIndex)) {
    if (!placed.has(pad)) entries.push({ kind: 'scratchPad', pad });
  }
  return entries;
}
