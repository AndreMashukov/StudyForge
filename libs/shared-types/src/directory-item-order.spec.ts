import { describe, expect, it } from 'vitest';
import {
  directoryTimeToMillis,
  sortArtifactsForDisplay,
  sortDocumentsForDisplay,
} from './directory-item-order';

const at = (iso: string) => new Date(iso);

describe('directoryTimeToMillis', () => {
  it('reads dates, strings, millis and timestamp shapes', () => {
    const ms = Date.parse('2026-01-02T00:00:00.000Z');
    expect(directoryTimeToMillis(new Date(ms))).toBe(ms);
    expect(directoryTimeToMillis('2026-01-02T00:00:00.000Z')).toBe(ms);
    expect(directoryTimeToMillis(ms)).toBe(ms);
    expect(directoryTimeToMillis({ toMillis: () => ms })).toBe(ms);
    expect(directoryTimeToMillis({ toDate: () => new Date(ms) })).toBe(ms);
    expect(directoryTimeToMillis({ seconds: ms / 1000, nanoseconds: 0 })).toBe(ms);
    expect(directoryTimeToMillis({ _seconds: ms / 1000 })).toBe(ms);
  });

  it('treats unreadable values as 0', () => {
    expect(directoryTimeToMillis('nope')).toBe(0);
    expect(directoryTimeToMillis(null)).toBe(0);
    expect(directoryTimeToMillis({})).toBe(0);
  });
});

describe('sortDocumentsForDisplay', () => {
  it('lists newest first when nothing was dragged', () => {
    const sorted = sortDocumentsForDisplay([
      { id: 'a', createdAt: at('2026-01-01') },
      { id: 'b', createdAt: at('2026-01-03') },
      { id: 'c', createdAt: at('2026-01-02') },
    ]);
    expect(sorted.map((item) => item.id)).toEqual(['b', 'c', 'a']);
  });

  it('puts dragged documents first, then the rest newest first', () => {
    const sorted = sortDocumentsForDisplay([
      { id: 'new', createdAt: at('2026-01-05') },
      { id: 'second', createdAt: at('2026-01-01'), sortOrder: 1 },
      { id: 'old', createdAt: at('2026-01-02') },
      { id: 'first', createdAt: at('2026-01-03'), sortOrder: 0 },
    ]);
    expect(sorted.map((item) => item.id)).toEqual([
      'first',
      'second',
      'new',
      'old',
    ]);
  });
});

describe('sortArtifactsForDisplay', () => {
  it('mixes types newest first and ignores sortOrder', () => {
    const sorted = sortArtifactsForDisplay([
      { id: 'quiz', createdAt: at('2026-01-01'), sortOrder: 0 },
      { id: 'cards', createdAt: at('2026-01-03') },
      { id: 'slides', createdAt: at('2026-01-02'), sortOrder: 5 },
    ]);
    expect(sorted.map((item) => item.id)).toEqual(['cards', 'slides', 'quiz']);
  });

  it('breaks ties by id', () => {
    const sorted = sortArtifactsForDisplay([
      { id: 'b', createdAt: at('2026-01-01') },
      { id: 'a', createdAt: at('2026-01-01') },
    ]);
    expect(sorted.map((item) => item.id)).toEqual(['a', 'b']);
  });
});
