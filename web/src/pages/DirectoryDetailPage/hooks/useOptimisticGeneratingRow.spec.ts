import { describe, expect, it } from 'vitest';
import type { IPendingGeneration } from '../../../store/slices/artifactGenerationSlice';
import { selectOptimisticGeneratingPlaceholders } from './useOptimisticGeneratingRow';

function generation(
  overrides: Partial<IPendingGeneration> & Pick<IPendingGeneration, 'id'>,
): IPendingGeneration {
  return {
    directoryId: 'dir-1',
    artifactType: 'sources',
    optimisticTitle: 'Write 40 words about condensation for a QA flicker…',
    ...overrides,
  };
}

describe('selectOptimisticGeneratingPlaceholders', () => {
  const title = 'Write 40 words about condensation for a QA flicker…';

  it('shows a ghost row when the list is still empty', () => {
    const placeholders = selectOptimisticGeneratingPlaceholders(
      [generation({ id: 'pending-1', optimisticTitle: title })],
      'dir-1',
      'sources',
      [],
    );

    expect(placeholders).toEqual([{ id: 'pending-1', title }]);
  });

  it('hides the ghost in the same pass once the matching pending document exists', () => {
    const placeholders = selectOptimisticGeneratingPlaceholders(
      [generation({ id: 'pending-1', optimisticTitle: title })],
      'dir-1',
      'sources',
      [{ title, generationStatus: 'pending' }],
    );

    expect(placeholders).toEqual([]);
  });

  it('keeps a second in-flight create visible while another title is already pending', () => {
    const placeholders = selectOptimisticGeneratingPlaceholders(
      [
        generation({ id: 'pending-1', optimisticTitle: 'First prompt title' }),
        generation({ id: 'pending-2', optimisticTitle: 'Second prompt title' }),
      ],
      'dir-1',
      'sources',
      [{ title: 'First prompt title', generationStatus: 'pending' }],
    );

    expect(placeholders).toEqual([
      { id: 'pending-2', title: 'Second prompt title' },
    ]);
  });

  it('shows one ghost when two same-title creates are in flight and only one row has landed', () => {
    const placeholders = selectOptimisticGeneratingPlaceholders(
      [
        generation({ id: 'pending-1', optimisticTitle: title }),
        generation({ id: 'pending-2', optimisticTitle: title }),
      ],
      'dir-1',
      'sources',
      [{ title, generationStatus: 'pending' }],
    );

    expect(placeholders).toEqual([{ id: 'pending-2', title }]);
  });

  it('does not treat a completed row as the in-flight create', () => {
    const placeholders = selectOptimisticGeneratingPlaceholders(
      [generation({ id: 'pending-1', optimisticTitle: title })],
      'dir-1',
      'sources',
      [{ title, generationStatus: 'completed' }],
    );

    expect(placeholders).toEqual([{ id: 'pending-1', title }]);
  });
});
