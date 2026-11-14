import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getStatisticsOverviewFromFirestore,
  getStatisticsQuizDetailFromFirestore,
} from './statisticsFirestore';

interface IRequest {
  path: string;
  constraints: unknown[];
}
const mocks = vi.hoisted(() => ({ getDocs: vi.fn(), getDoc: vi.fn() }));
vi.mock('../config/firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', async (importOriginal) => ({
  ...(await importOriginal<typeof import('firebase/firestore')>()),
  collection: vi.fn((_db, ...path: string[]) => path.join('/')),
  doc: vi.fn((_db, ...path: string[]) => path.join('/')),
  query: vi.fn(
    (path: string, ...constraints: unknown[]): IRequest => ({
      path,
      constraints,
    }),
  ),
  where: vi.fn((field, operator, value) => ({ field, operator, value })),
  orderBy: vi.fn((field, direction) => ({ field, direction })),
  limit: vi.fn((value) => ({ limit: value })),
  getDocs: mocks.getDocs,
  getDoc: mocks.getDoc,
}));
const answer = {
  questionIndex: 0,
  questionText: 'Choose the right record',
  selectedAnswer: 0,
  correctAnswer: 1,
  isCorrect: false,
  knowledge: {},
  detailedExplanationRequested: false,
};
const attempt = {
  userId: 'u',
  quizId: 'q',
  quizType: 'quiz',
  date: '2026-11-14',
  completedAt: new Date('2026-11-14T10:00:00Z'),
  startedAt: new Date('2026-11-14T09:00:00Z'),
  answers: [answer],
  documentIds: [],
  score: 0,
  percentage: 0,
  totalQuestions: 1,
  durationMs: 10,
};
const range = { startDate: '2026-11-01', endDate: '2026-11-14' };
function attempts(rows: object[]) {
  mocks.getDocs.mockImplementation(async (request: IRequest | string) => ({
    docs: (typeof request === 'string' ? request : request.path).endsWith(
      'quizAttempts',
    )
      ? rows.map((row, i) => ({ id: String(i), data: () => row }))
      : [],
  }));
}

describe('Progress Firestore reads', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    attempts([attempt]);
    mocks.getDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        title: 'Access rules',
        questions: [
          {
            question: answer.questionText,
            options: ['Pending invitation', 'Practice membership'],
          },
        ],
      }),
    });
  });
  it('resolves quiz text in the overview and detail and excludes flashcard and interaction reads', async () => {
    const overview = await getStatisticsOverviewFromFirestore(
      'u',
      range,
      undefined,
      100,
    );
    expect(overview.recentFailures[0].selectedAnswerLabel).toBe(
      'Pending invitation',
    );
    expect(overview.recentFailures[0].correctAnswerLabel).toBe(
      'Practice membership',
    );
    expect(overview.flashcardFailures).toEqual([]);
    const reads: IRequest[] = mocks.getDocs.mock.calls.map((call) =>
      typeof call[0] === 'string'
        ? { path: call[0], constraints: [] }
        : call[0],
    );
    expect(reads.some((read) => /flashcard|interaction/i.test(read.path))).toBe(
      false,
    );
    expect(
      reads.some((read) =>
        read.constraints.some(
          (constraint) =>
            typeof constraint === 'object' &&
            constraint !== null &&
            'limit' in constraint &&
            constraint.limit === 101,
        ),
      ),
    ).toBe(true);
    const detail = await getStatisticsQuizDetailFromFirestore('u', {
      ...range,
      quizType: 'quiz',
      quizId: 'q',
    });
    expect(detail.failedQuestions[0].correctAnswerLabel).toBe(
      'Practice membership',
    );
  });
  it('enriches match failures with readable pairs and groups repeat misses', async () => {
    const row = {
      ...attempt,
      quizType: 'matchQuiz',
      answers: [{ ...answer, selectedAnswer: ['o2'], correctAnswer: ['o1'] }],
    };
    attempts([row, { ...row, completedAt: new Date('2026-11-13T10:00:00Z') }]);
    mocks.getDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        questions: [
          {
            prompts: [{ id: 'p', text: 'Personal tenant' }],
            options: [
              { id: 'o1', text: 'Tenant record' },
              { id: 'o2', text: 'Auth user' },
            ],
          },
        ],
      }),
    });
    const result = await getStatisticsOverviewFromFirestore('u', range);
    expect(result.recentFailures).toHaveLength(1);
    expect(result.recentFailures[0].repeatedFailureCount).toBe(2);
    expect(result.recentFailures[0].matchPairs).toEqual([
      {
        prompt: 'Personal tenant',
        selectedText: 'Auth user',
        correctText: 'Tenant record',
        isCorrect: false,
      },
    ]);
  });
  it('keeps missing quizzes reviewable without inventing option text', async () => {
    mocks.getDoc.mockResolvedValue({ exists: () => false });
    const result = await getStatisticsOverviewFromFirestore('u', range);
    expect(result.recentFailures[0].questionText).toBe(answer.questionText);
    expect(result.recentFailures[0].selectedAnswerLabel).toBe(
      'Answer text unavailable',
    );
  });
});
