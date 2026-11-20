import { describe, expect, it } from 'vitest';
import { directoryPath } from './directoryPath';

const directories = [
  { id: 'bio', name: 'Biology 201', parentId: null },
  { id: 'cell', name: 'Cell Biology', parentId: 'bio' },
];

describe('directoryPath', () => {
  it('builds a breadcrumb from the root', () => {
    expect(directoryPath(directories, 'cell')).toBe(
      'Biology 201 › Cell Biology',
    );
  });

  it('is empty for a missing directory', () => {
    expect(directoryPath(directories, 'gone')).toBe('');
    expect(directoryPath(directories, null)).toBe('');
  });
});
