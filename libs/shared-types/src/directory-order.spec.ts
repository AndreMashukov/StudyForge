import { describe, expect, it } from 'vitest';
import {
  compareFolderOrder,
  hasManualFolderOrder,
  sortFoldersForDisplay,
} from './directory-order';

const names = (folders: { name: string }[]) => folders.map((f) => f.name);

describe('folder display order', () => {
  it('sorts A–Z (case-insensitive) when nothing was reordered', () => {
    const folders = [{ name: 'beta' }, { name: 'Alpha' }, { name: 'gamma' }];
    expect(names(sortFoldersForDisplay(folders))).toEqual([
      'Alpha',
      'beta',
      'gamma',
    ]);
    expect(hasManualFolderOrder(folders)).toBe(false);
  });

  it('puts manually ordered folders first, then the rest A–Z', () => {
    const folders = [
      { name: 'New folder' },
      { name: 'Zebra', sortOrder: 0 },
      { name: 'Apple' },
      { name: 'Mango', sortOrder: 1 },
    ];
    expect(names(sortFoldersForDisplay(folders))).toEqual([
      'Zebra',
      'Mango',
      'Apple',
      'New folder',
    ]);
    expect(hasManualFolderOrder(folders)).toBe(true);
  });

  it('falls back to the name when two positions are equal', () => {
    expect(
      compareFolderOrder(
        { name: 'b', sortOrder: 2 },
        { name: 'a', sortOrder: 2 },
      ),
    ).toBeGreaterThan(0);
  });

  it('does not mutate the input', () => {
    const folders = [{ name: 'b' }, { name: 'a' }];
    sortFoldersForDisplay(folders);
    expect(names(folders)).toEqual(['b', 'a']);
  });
});
