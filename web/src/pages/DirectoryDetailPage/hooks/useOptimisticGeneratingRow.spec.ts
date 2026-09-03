import { describe, expect, it } from 'vitest';
import type { IPendingGeneration } from '../../../store/slices/artifactGenerationSlice';
import { selectOptimisticGeneratingPlaceholders } from './useOptimisticGeneratingRow';

const STARTED_AT_MS = Date.parse('2026-09-03T10:25:00.000Z');

function generation(
  overrides: Partial<IPendingGeneration> & Pick<IPendingGeneration, 'id'>,
): IPendingGeneration {
  return {
    directoryId: 'dir-1',
    artifactType: 'sources',
    optimisticTitle: 'Write 40 words about condensation for a QA flicker…',
    startedAtMs: STARTED_AT_MS,
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

  it('hides an untitled artifact ghost when a newer pending row lands with a server title', () => {
    const placeholders = selectOptimisticGeneratingPlaceholders(
      [
        generation({
          id: 'pending-1',
          artifactType: 'matchQuizzes',
          optimisticTitle: undefined,
        }),
      ],
      'dir-1',
      'matchQuizzes',
      [
        {
          title: 'Match Quiz from QA Water Cycle 50plus',
          generationStatus: 'pending',
          createdAt: '2026-09-03T10:25:00.400Z',
        },
      ],
    );

    expect(placeholders).toEqual([]);
  });

  it('keeps an untitled ghost when the only pending row is from an earlier create', () => {
    const placeholders = selectOptimisticGeneratingPlaceholders(
      [
        generation({
          id: 'pending-2',
          artifactType: 'matchQuizzes',
          optimisticTitle: undefined,
          startedAtMs: Date.parse('2026-09-03T10:30:00.000Z'),
        }),
      ],
      'dir-1',
      'matchQuizzes',
      [
        {
          title: 'Match Quiz from QA Water Cycle 50plus · 9/3/2026',
          generationStatus: 'pending',
          createdAt: '2026-09-03T10:25:00.000Z',
        },
      ],
    );

    expect(placeholders).toEqual([{ id: 'pending-2', title: 'Preparing...' }]);
  });

  it('shows one untitled ghost when two creates are in flight and only one pending row has landed', () => {
    const placeholders = selectOptimisticGeneratingPlaceholders(
      [
        generation({
          id: 'pending-1',
          artifactType: 'matchQuizzes',
          optimisticTitle: undefined,
          startedAtMs: Date.parse('2026-09-03T10:25:00.000Z'),
        }),
        generation({
          id: 'pending-2',
          artifactType: 'matchQuizzes',
          optimisticTitle: undefined,
          startedAtMs: Date.parse('2026-09-03T10:25:01.000Z'),
        }),
      ],
      'dir-1',
      'matchQuizzes',
      [
        {
          title: 'Match Quiz from QA Water Cycle 50plus',
          generationStatus: 'pending',
          createdAt: '2026-09-03T10:25:00.200Z',
        },
      ],
    );

    expect(placeholders).toEqual([{ id: 'pending-2', title: 'Preparing...' }]);
  });
});
