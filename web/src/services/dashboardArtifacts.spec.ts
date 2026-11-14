import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import {
  fetchCompletedDashboardArtifacts,
  toCompletedDashboardArtifact,
} from './dashboardArtifacts';

interface IConstraint {
  field?: string;
  operator?: string;
  value?: unknown;
  limit?: number;
  cursor?: string;
  order?: string;
}
interface IRequest {
  path: string;
  constraints: IConstraint[];
}
const mocks = vi.hoisted(() => ({
  read: vi.fn<
    (request: IRequest) => Promise<{
      docs: Array<{
        id: string;
        data: () => {
          completedAt: Timestamp;
          generationStatus: string;
          title: string;
        };
      }>;
      size: number;
    }>
  >(),
}));
vi.mock('../config/firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', async (importOriginal) => {
  const original = await importOriginal<typeof import('firebase/firestore')>();
  return {
    ...original,
    collection: vi.fn((_db, ...path: string[]) => path.join('/')),
    query: vi.fn((path: string, ...constraints: IConstraint[]) => ({
      path,
      constraints,
    })),
    where: vi.fn((field: string, operator: string, value: unknown) => ({
      field,
      operator,
      value,
    })),
    orderBy: vi.fn((field: string) => ({ order: field })),
    limit: vi.fn((value: number) => ({ limit: value })),
    startAfter: vi.fn((record: { id: string }) => ({ cursor: record.id })),
    getDocsFromServer: mocks.read,
  };
});

const completedAt = Timestamp.fromDate(new Date('2026-11-14T12:00:00Z'));

describe('dashboard artifact completion records', () => {
  beforeEach(() => vi.clearAllMocks());
  it('includes completed records and compatible dated legacy records, never pending or failed', () => {
    expect(
      toCompletedDashboardArtifact('q', 'quiz', {
        completedAt,
        generationStatus: 'completed',
      })?.completedAt,
    ).toBe('2026-11-14T12:00:00.000Z');
    expect(
      toCompletedDashboardArtifact('legacy', 'quiz', { completedAt }),
    ).not.toBeNull();
    expect(
      toCompletedDashboardArtifact('pending', 'quiz', {
        completedAt,
        generationStatus: 'pending',
      }),
    ).toBeNull();
    expect(
      toCompletedDashboardArtifact('failed', 'quiz', {
        completedAt,
        generationStatus: 'failed',
      }),
    ).toBeNull();
    expect(
      toCompletedDashboardArtifact('undated', 'quiz', {
        createdAt: completedAt,
      }),
    ).toBeNull();
    expect(
      toCompletedDashboardArtifact('bad', 'quiz', { completedAt: 'invalid' }),
    ).toBeNull();
  });
  it('pages beyond 50 matching records under each user collection and enforces an exclusive UTC end', async () => {
    const calls: IRequest[] = [];
    mocks.read.mockImplementation(async (descriptor) => {
      calls.push(descriptor);
      const cursor = descriptor.constraints.find(
        (constraint) => constraint.cursor,
      )?.cursor;
      const offset = cursor ? Number(cursor.split('-')[1]) + 1 : 0;
      const count = descriptor.path === 'users/u/quizzes' ? 105 : 0;
      const docs = Array.from(
        { length: Math.min(50, count - offset) },
        (_, index) => ({
          id: `q-${index + offset}`,
          data: () => ({
            completedAt,
            generationStatus: index + offset === 60 ? 'failed' : 'completed',
            title: 'Quiz',
          }),
        }),
      );
      return { docs, size: docs.length };
    });
    const artifacts = await fetchCompletedDashboardArtifacts('u', {
      startDate: '2026-11-14',
      endDate: '2026-11-14',
    });
    expect(artifacts).toHaveLength(104);
    expect(mocks.read).toHaveBeenCalledTimes(8);
    for (const descriptor of calls) {
      expect(descriptor.path).toMatch(
        /^users\/u\/(quizzes|flashcardSets|slideDecks|diagramQuizzes|sequenceQuizzes|matchQuizzes)$/,
      );
      expect(descriptor.constraints).toContainEqual({ limit: 50 });
      const end = descriptor.constraints.find(
        (constraint) => constraint.operator === '<',
      )?.value;
      expect(end).toBeInstanceOf(Timestamp);
      if (end instanceof Timestamp)
        expect(end.toDate().toISOString()).toBe('2026-11-15T00:00:00.000Z');
    }
  });
  it('reports read failure instead of returning a partial successful count', async () => {
    mocks.read.mockRejectedValue(new Error('permission denied'));
    await expect(
      fetchCompletedDashboardArtifacts('u', {
        startDate: '2026-11-14',
        endDate: '2026-11-14',
      }),
    ).rejects.toThrow('permission denied');
  });
});
