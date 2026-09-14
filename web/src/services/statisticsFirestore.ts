import {
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  Timestamp,
  where,
  type QueryConstraint,
} from 'firebase/firestore';
import {
  ArtifactType,
  GetStatisticsLearningTimeResponse,
  GetStatisticsOverviewResponse,
  GetStatisticsQuizDetailRequest,
  GetStatisticsQuizDetailResponse,
  GetStatisticsQuizPerformanceResponse,
  QuizAnswerValue,
  QuizAttempt,
  QuizAttemptAnswer,
  QuizTelemetryType,
  StatisticsDateRangeRequest,
  StatisticsDocumentSummary,
  StatisticsLearningTimeArtifact,
  StatisticsLearningTimeByType,
  StatisticsQuestionBreakdownItem,
  StatisticsQuizDetailAttempt,
  StatisticsQuizPerformanceItem,
  StatisticsQuizTypeFilter,
  StatisticsAttemptCursor,
  StatisticsFlashcardFailure,
  StatisticsFlashcardSessionCursor,
  StatisticsOverviewAttempt,
  StatisticsOverviewAttemptAnswer,
  StatisticsRecentFailure,
  FlashcardStudySession,
} from '@shared-types';
import {
  flashcardFailureGroupKey,
  quizFailureGroupKey,
} from '@shared-types';
import {
  diagramQuizRef,
  documentRef,
  flashcardSetRef,
  flashcardStudySessionCollection,
  interactionSessionCollection,
  learningEventCollection,
  quizAttemptCollection,
  quizRef,
  sequenceQuizRef,
  matchQuizRef,
  slideDeckRef,
  statisticsHiddenFailureCollection,
} from './firestorePaths';

export interface StatisticsScopeOptions {
  directoryIds?: string[];
}

export interface IStoredAttempt extends QuizAttempt {
  completedAtDate: Date;
}

interface IQuizMetadata {
  title?: string;
  questions: Array<{
    question?: string;
    hint?: string;
    explanation?: string;
    options?: string[];
    diagrams?: string[];
    diagramLabels?: string[];
    items?: string[];
  }>;
}

export const ATTEMPT_PAGE_SIZE = 50;
export const FLASHCARD_SESSION_PAGE_SIZE = 50;
const MAX_ATTEMPTS_TO_SCAN = 500;
const MAX_EVENTS_TO_SCAN = 500;
const MAX_INTERACTION_SESSIONS_TO_SCAN = 1000;

const ARTIFACT_TYPE_LABELS: Record<ArtifactType, string> = {
  document: 'Document',
  quiz: 'Quiz',
  flashcardSet: 'Flashcard set',
  slideDeck: 'Slide deck',
  diagramQuiz: 'Diagram quiz',
  sequenceQuiz: 'Sequence quiz',
  matchQuiz: 'Match quiz',
};

function normalizeQuizType(
  value: StatisticsQuizTypeFilter | undefined,
): StatisticsQuizTypeFilter {
  return value ?? 'all';
}

function parseDay(value: string | undefined, endOfDay = false): Date | null {
  if (!value) return null;
  const date = new Date(
    `${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`,
  );
  return Number.isNaN(date.getTime()) ? null : date;
}

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (value instanceof Timestamp) return value.toDate();
  if (
    typeof value === 'object'
    && value !== null
    && 'toDate' in value
    && typeof value.toDate === 'function'
  ) {
    return value.toDate();
  }
  if (typeof value === 'string') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

function toIso(value: unknown): string | undefined {
  return toDate(value)?.toISOString();
}

function accuracy(correct: number, total: number): number {
  return total > 0 ? Math.round((correct / total) * 100) : 0;
}

function matchesQuizType(
  attempt: QuizAttempt,
  quizType: StatisticsQuizTypeFilter,
): boolean {
  return quizType === 'all' || attempt.quizType === quizType;
}

function matchesDirectoryScope(
  attempt: QuizAttempt,
  directoryIds: string[] | undefined,
): boolean {
  if (!directoryIds || directoryIds.length === 0) {
    return true;
  }
  return Boolean(
    attempt.directoryId && directoryIds.includes(attempt.directoryId),
  );
}

function sourceDocumentIds(
  answer: QuizAttemptAnswer,
  attempt: QuizAttempt,
): string[] {
  const answerSources = answer.knowledge?.sourceDocumentIds ?? [];
  return answerSources.length > 0 ? answerSources : (attempt.documentIds ?? []);
}

function answerLabel(
  value: QuizAnswerValue,
  question?: IQuizMetadata['questions'][number],
): string {
  if (Array.isArray(value)) return value.join(', ');
  if (value === null || value === undefined) return 'No answer';
  if (typeof value === 'number') {
    const label =
      question?.diagramLabels?.[value]
      ?? question?.options?.[value]
      ?? question?.diagrams?.[value];
    return label ? String(label) : `Option ${value + 1}`;
  }
  return String(value);
}

function diagramCodeAt(
  question: IQuizMetadata['questions'][number] | undefined,
  value: QuizAnswerValue,
): string | undefined {
  if (typeof value !== 'number' || value < 0) return undefined;
  const code = question?.diagrams?.[value];
  return typeof code === 'string' && code.trim().length > 0 ? code : undefined;
}

function applyDateRangeConstraints(
  range: StatisticsDateRangeRequest,
  field = 'date',
): QueryConstraint[] {
  const constraints: QueryConstraint[] = [];
  if (range.startDate) {
    constraints.push(where(field, '>=', range.startDate));
  }
  if (range.endDate) {
    constraints.push(where(field, '<=', range.endDate));
  }
  return constraints;
}

async function getDocumentSummaries(
  userId: string,
  documentIds: string[],
  cache: Map<string, StatisticsDocumentSummary>,
): Promise<StatisticsDocumentSummary[]> {
  const uniqueIds = Array.from(new Set(documentIds.filter(Boolean)));
  const summaries: StatisticsDocumentSummary[] = [];

  for (const docId of uniqueIds) {
    const cached = cache.get(docId);
    if (cached) {
      summaries.push(cached);
      continue;
    }

    const snap = await getDoc(documentRef(userId, docId));
    const title = snap.exists()
      ? String(snap.data()?.title ?? 'Untitled document')
      : 'Unknown document';
    const summary = { id: docId, title };
    cache.set(docId, summary);
    summaries.push(summary);
  }

  return summaries;
}

async function getQuizMetadata(
  userId: string,
  quizType: QuizTelemetryType,
  quizId: string,
  cache: Map<string, IQuizMetadata>,
): Promise<IQuizMetadata> {
  const cacheKey = `${quizType}:${quizId}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const quizDocRef =
    quizType === 'quiz'
      ? quizRef(userId, quizId)
      : quizType === 'diagramQuiz'
        ? diagramQuizRef(userId, quizId)
        : quizType === 'matchQuiz'
          ? matchQuizRef(userId, quizId)
          : sequenceQuizRef(userId, quizId);

  const snap = await getDoc(quizDocRef);
  const data = snap.exists() ? (snap.data() ?? {}) : {};
  const metadata = {
    title: typeof data.title === 'string' ? data.title : undefined,
    questions: Array.isArray(data.questions) ? data.questions : [],
  } as IQuizMetadata;
  cache.set(cacheKey, metadata);
  return metadata;
}

function orderNewestFirst(
  range: StatisticsDateRangeRequest,
  rangeField: string,
  unboundedField: string,
): QueryConstraint {
  return range.startDate || range.endDate
    ? orderBy(rangeField, 'desc')
    : orderBy(unboundedField, 'desc');
}

export async function getHiddenFailureGroupKeys(
  userId: string,
): Promise<Set<string>> {
  const snapshot = await getDocs(statisticsHiddenFailureCollection(userId));
  const keys = new Set<string>();
  for (const hiddenDoc of snapshot.docs) {
    const data = hiddenDoc.data();
    const groupKey =
      typeof data.groupKey === 'string' ? data.groupKey : hiddenDoc.id;
    keys.add(groupKey);
  }
  return keys;
}

function isQuestionHidden(
  hiddenKeys: Set<string>,
  quizType: QuizTelemetryType,
  quizId: string,
  questionIndex: number,
): boolean {
  return hiddenKeys.has(quizFailureGroupKey(quizType, quizId, questionIndex));
}

function mapAttemptDoc(
  docSnap: { id: string; data: () => Record<string, unknown> | undefined },
): IStoredAttempt {
  const data = { id: docSnap.id, ...(docSnap.data() ?? {}) } as QuizAttempt;
  return {
    ...data,
    completedAtDate: toDate(data.completedAt) ?? new Date(0),
  };
}

function serializeOverviewAttemptAnswer(
  answer: QuizAttemptAnswer,
): StatisticsOverviewAttemptAnswer {
  return {
    questionIndex: answer.questionIndex,
    questionText: answer.questionText,
    selectedAnswer: answer.selectedAnswer,
    correctAnswer: answer.correctAnswer,
    isCorrect: answer.isCorrect,
    ...(answer.timeSpentMs !== undefined ? { timeSpentMs: answer.timeSpentMs } : {}),
    knowledge: answer.knowledge,
    detailedExplanationRequested: answer.detailedExplanationRequested,
    ...(answer.detailedExplanationRequestedAt
      ? {
          detailedExplanationRequestedAt:
            toIso(answer.detailedExplanationRequestedAt),
        }
      : {}),
  };
}

export function serializeOverviewAttempt(
  attempt: IStoredAttempt,
): StatisticsOverviewAttempt {
  return {
    id: attempt.id,
    userId: attempt.userId,
    quizId: attempt.quizId,
    quizType: attempt.quizType,
    documentIds: attempt.documentIds,
    directoryId: attempt.directoryId,
    startedAt: toIso(attempt.startedAt) ?? new Date(0).toISOString(),
    completedAt: attempt.completedAtDate.toISOString(),
    durationMs: attempt.durationMs,
    score: attempt.score,
    totalQuestions: attempt.totalQuestions,
    percentage: attempt.percentage,
    answers: (attempt.answers ?? []).map(serializeOverviewAttemptAnswer),
    date: attempt.date,
    ...(attempt.isPartial ? { isPartial: true } : {}),
  };
}

function filterAttempts(
  attempts: IStoredAttempt[],
  range: StatisticsDateRangeRequest,
  scope?: StatisticsScopeOptions,
  quizFilter?: { quizId: string; quizType: QuizTelemetryType },
): IStoredAttempt[] {
  const quizType = normalizeQuizType(range.quizType);
  return dedupeAttempts(
    attempts
      .filter((attempt) => matchesQuizType(attempt, quizType))
      .filter((attempt) => matchesDirectoryScope(attempt, scope?.directoryIds))
      .filter((attempt) =>
        quizFilter
          ? attempt.quizId === quizFilter.quizId
            && attempt.quizType === quizFilter.quizType
          : true,
      )
      .sort(
        (left, right) =>
          right.completedAtDate.getTime() - left.completedAtDate.getTime(),
      ),
  );
}

export async function fetchQuizAttemptsPage(
  userId: string,
  range: StatisticsDateRangeRequest,
  scope?: StatisticsScopeOptions,
  cursor?: StatisticsAttemptCursor,
  pageSize = ATTEMPT_PAGE_SIZE,
  quizFilter?: { quizId: string; quizType: QuizTelemetryType },
): Promise<{
  attempts: IStoredAttempt[];
  nextCursor?: StatisticsAttemptCursor;
  hasMore: boolean;
}> {
  const constraints: QueryConstraint[] = [...applyDateRangeConstraints(range)];
  if (quizFilter) {
    constraints.push(where('quizId', '==', quizFilter.quizId));
    constraints.push(where('quizType', '==', quizFilter.quizType));
  }
  constraints.push(orderNewestFirst(range, 'date', 'completedAt'));

  if (cursor?.attemptId) {
    const cursorSnap = await getDoc(
      doc(quizAttemptCollection(userId), cursor.attemptId),
    );
    if (cursorSnap.exists()) {
      constraints.push(startAfter(cursorSnap));
    }
  }

  constraints.push(limit(pageSize + 1));

  const snapshot = await getDocs(
    query(quizAttemptCollection(userId), ...constraints),
  );

  const rawAttempts = snapshot.docs.map(mapAttemptDoc);
  const hasMore = rawAttempts.length > pageSize;
  const rawPageAttempts = hasMore
    ? rawAttempts.slice(0, pageSize)
    : rawAttempts;
  const pageAttempts = filterAttempts(
    rawPageAttempts,
    range,
    scope,
    quizFilter,
  );

  const lastRawAttempt = rawPageAttempts.at(-1);
  const nextCursor =
    hasMore && lastRawAttempt
      ? {
          completedAt: lastRawAttempt.completedAtDate.toISOString(),
          attemptId: lastRawAttempt.id,
        }
      : undefined;

  return {
    attempts: pageAttempts,
    nextCursor,
    hasMore,
  };
}

export async function getAttemptsForStatisticsOverview(
  userId: string,
  range: StatisticsDateRangeRequest,
  scope?: StatisticsScopeOptions,
  quizFilter?: { quizId: string; quizType: QuizTelemetryType },
): Promise<IStoredAttempt[]> {
  const { attempts } = await fetchQuizAttemptsPage(
    userId,
    range,
    scope,
    undefined,
    MAX_ATTEMPTS_TO_SCAN,
    quizFilter,
  );
  return attempts;
}

function dedupeAttempts(attempts: IStoredAttempt[]): IStoredAttempt[] {
  const seen = new Set<string>();
  const unique: IStoredAttempt[] = [];
  for (const attempt of attempts) {
    const key = `${attempt.quizType}:${attempt.quizId}:${attempt.completedAtDate.getTime()}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(attempt);
  }
  return unique;
}

function buildQuestionBreakdown(
  attempts: IStoredAttempt[],
  hiddenKeys: Set<string> = new Set(),
): StatisticsQuestionBreakdownItem[] {
  const grouped = new Map<
    number,
    {
      questionIndex: number;
      questionText: string;
      answerCount: number;
      correctCount: number;
      incorrectCount: number;
    }
  >();

  for (const attempt of attempts) {
    for (const answer of attempt.answers ?? []) {
      if (
        isQuestionHidden(
          hiddenKeys,
          attempt.quizType,
          attempt.quizId,
          answer.questionIndex,
        )
      ) {
        continue;
      }
      const existing = grouped.get(answer.questionIndex) ?? {
        questionIndex: answer.questionIndex,
        questionText: answer.questionText,
        answerCount: 0,
        correctCount: 0,
        incorrectCount: 0,
      };
      existing.answerCount += 1;
      if (answer.isCorrect) {
        existing.correctCount += 1;
      } else {
        existing.incorrectCount += 1;
      }
      if (!existing.questionText && answer.questionText) {
        existing.questionText = answer.questionText;
      }
      grouped.set(answer.questionIndex, existing);
    }
  }

  return Array.from(grouped.values())
    .sort((left, right) => left.questionIndex - right.questionIndex)
    .map((item) => ({
      ...item,
      accuracyPercentage: accuracy(item.correctCount, item.answerCount),
    }));
}

async function getExplanationCountsByQuiz(
  userId: string,
  range: StatisticsDateRangeRequest,
): Promise<Map<string, number>> {
  const constraints: QueryConstraint[] = [
    where('eventType', '==', 'detailed_explanation_requested'),
  ];
  const start = parseDay(range.startDate);
  const end = parseDay(range.endDate, true);
  if (start) constraints.push(where('occurredAt', '>=', Timestamp.fromDate(start)));
  if (end) constraints.push(where('occurredAt', '<=', Timestamp.fromDate(end)));
  constraints.push(orderBy('occurredAt', 'desc'));
  constraints.push(limit(MAX_EVENTS_TO_SCAN));

  const quizType = normalizeQuizType(range.quizType);
  const snapshot = await getDocs(
    query(learningEventCollection(userId), ...constraints),
  );
  const counts = new Map<string, number>();

  for (const eventDoc of snapshot.docs) {
    const event = eventDoc.data();
    if (event.eventType !== 'detailed_explanation_requested') continue;
    if (quizType !== 'all' && event.quizType !== quizType) continue;
    const key = `${event.quizType}:${event.quizId}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return counts;
}

interface IGroupedFailureEntry {
  attempt: IStoredAttempt;
  answer: QuizAttemptAnswer;
  occurredAt: Date;
}

function computeOverviewMetricsFromAttempts(
  attempts: IStoredAttempt[],
  hiddenKeys: Set<string>,
  explanationRequestCount: number,
): GetStatisticsOverviewResponse['metrics'] {
  const quizIds = new Set<string>();
  let answeredQuestionCount = 0;
  let correctAnswerCount = 0;

  for (const attempt of attempts) {
    quizIds.add(`${attempt.quizType}:${attempt.quizId}`);
    for (const answer of attempt.answers ?? []) {
      if (
        isQuestionHidden(
          hiddenKeys,
          attempt.quizType,
          attempt.quizId,
          answer.questionIndex,
        )
      ) {
        continue;
      }
      answeredQuestionCount += 1;
      if (answer.isCorrect) {
        correctAnswerCount += 1;
      }
    }
  }

  const incorrectAnswerCount = Math.max(
    0,
    answeredQuestionCount - correctAnswerCount,
  );

  return {
    attemptCount: attempts.length,
    quizCount: quizIds.size,
    answeredQuestionCount,
    correctAnswerCount,
    incorrectAnswerCount,
    explanationRequestCount,
    accuracyPercentage: accuracy(correctAnswerCount, answeredQuestionCount),
  };
}

async function buildGroupedFailures(
  userId: string,
  attempts: IStoredAttempt[],
  hiddenKeys: Set<string>,
  filter?: (answer: QuizAttemptAnswer, attempt: IStoredAttempt) => boolean,
): Promise<StatisticsRecentFailure[]> {
  const quizCache = new Map<string, IQuizMetadata>();
  const documentCache = new Map<string, StatisticsDocumentSummary>();
  const grouped = new Map<string, IGroupedFailureEntry>();

  for (const attempt of attempts) {
    for (const answer of attempt.answers ?? []) {
      if (answer.isCorrect || (filter && !filter(answer, attempt))) continue;

      const groupKey = quizFailureGroupKey(
        attempt.quizType,
        attempt.quizId,
        answer.questionIndex,
      );
      if (hiddenKeys.has(groupKey)) continue;

      const existing = grouped.get(groupKey);
      if (
        !existing
        || attempt.completedAtDate.getTime() > existing.occurredAt.getTime()
      ) {
        grouped.set(groupKey, {
          attempt,
          answer,
          occurredAt: attempt.completedAtDate,
        });
      }
    }
  }

  const repeatCounts = new Map<string, number>();
  for (const attempt of attempts) {
    for (const answer of attempt.answers ?? []) {
      if (answer.isCorrect || (filter && !filter(answer, attempt))) continue;
      const groupKey = quizFailureGroupKey(
        attempt.quizType,
        attempt.quizId,
        answer.questionIndex,
      );
      if (hiddenKeys.has(groupKey)) continue;
      repeatCounts.set(groupKey, (repeatCounts.get(groupKey) ?? 0) + 1);
    }
  }

  const sortedGroups = Array.from(grouped.entries()).sort(
    (left, right) =>
      right[1].occurredAt.getTime() - left[1].occurredAt.getTime(),
  );

  const result: StatisticsRecentFailure[] = [];
  for (const [groupKey, failure] of sortedGroups) {
    const { attempt, answer } = failure;
    const metadata = await getQuizMetadata(
      userId,
      attempt.quizType,
      attempt.quizId,
      quizCache,
    );
    const question = metadata.questions[answer.questionIndex];
    const documents = await getDocumentSummaries(
      userId,
      sourceDocumentIds(answer, attempt),
      documentCache,
    );

    const selectedDiagramCode =
      attempt.quizType === 'diagramQuiz'
        ? diagramCodeAt(question, answer.selectedAnswer)
        : undefined;
    const correctDiagramCode =
      attempt.quizType === 'diagramQuiz'
        ? diagramCodeAt(question, answer.correctAnswer)
        : undefined;

    result.push({
      id: groupKey,
      groupKey,
      attemptId: attempt.id,
      quizId: attempt.quizId,
      quizType: attempt.quizType,
      quizTitle: metadata.title,
      questionIndex: answer.questionIndex,
      questionText: answer.questionText,
      ...(typeof question?.hint === 'string' ? { hint: question.hint } : {}),
      ...(typeof question?.explanation === 'string'
        ? { explanation: question.explanation }
        : {}),
      selectedAnswer: answer.selectedAnswer,
      selectedAnswerLabel: answerLabel(answer.selectedAnswer, question),
      correctAnswer: answer.correctAnswer,
      correctAnswerLabel: answerLabel(answer.correctAnswer, question),
      ...(selectedDiagramCode ? { selectedDiagramCode } : {}),
      ...(correctDiagramCode ? { correctDiagramCode } : {}),
      knowledge: answer.knowledge,
      sourceDocuments: documents,
      occurredAt: failure.occurredAt.toISOString(),
      repeatedFailureCount: repeatCounts.get(groupKey) ?? 1,
    });
  }

  return result;
}

interface IStoredFlashcardSession extends FlashcardStudySession {
  completedAtDate: Date;
}

export async function fetchFlashcardStudySessionsPage(
  userId: string,
  range: StatisticsDateRangeRequest,
  cursor?: StatisticsFlashcardSessionCursor,
  pageSize = FLASHCARD_SESSION_PAGE_SIZE,
): Promise<{
  sessions: IStoredFlashcardSession[];
  nextCursor?: StatisticsFlashcardSessionCursor;
  hasMore: boolean;
}> {
  const constraints: QueryConstraint[] = [...applyDateRangeConstraints(range)];
  constraints.push(orderNewestFirst(range, 'date', 'completedAt'));

  if (cursor?.sessionId) {
    const cursorSnap = await getDoc(
      doc(flashcardStudySessionCollection(userId), cursor.sessionId),
    );
    if (cursorSnap.exists()) {
      constraints.push(startAfter(cursorSnap));
    }
  }

  constraints.push(limit(pageSize + 1));

  const snapshot = await getDocs(
    query(flashcardStudySessionCollection(userId), ...constraints),
  );

  const rawSessions = snapshot.docs.map((sessionDoc) => {
    const data = {
      id: sessionDoc.id,
      ...sessionDoc.data(),
    } as FlashcardStudySession;
    return {
      ...data,
      completedAtDate: toDate(data.completedAt) ?? new Date(0),
    };
  });

  const hasMore = rawSessions.length > pageSize;
  const sessions = hasMore ? rawSessions.slice(0, pageSize) : rawSessions;
  const lastSession = sessions.at(-1);
  const nextCursor =
    hasMore && lastSession
      ? {
          completedAt: lastSession.completedAtDate.toISOString(),
          sessionId: lastSession.id,
        }
      : undefined;

  return { sessions, nextCursor, hasMore };
}

export async function buildGroupedFlashcardFailures(
  userId: string,
  sessions: IStoredFlashcardSession[],
  hiddenKeys: Set<string>,
): Promise<StatisticsFlashcardFailure[]> {
  const setCache = new Map<string, { title?: string; cards: Map<string, { front: string; back: string; explanation?: string }> }>();
  const documentCache = new Map<string, StatisticsDocumentSummary>();
  const grouped = new Map<
    string,
    {
      session: IStoredFlashcardSession;
      cardId: string;
      occurredAt: Date;
    }
  >();
  const repeatCounts = new Map<string, number>();

  for (const session of sessions) {
    for (const card of session.cards ?? []) {
      if (card.outcome !== 'failed') continue;

      const groupKey = flashcardFailureGroupKey(
        session.flashcardSetId,
        card.cardId,
      );
      if (hiddenKeys.has(groupKey)) continue;

      repeatCounts.set(groupKey, (repeatCounts.get(groupKey) ?? 0) + 1);

      const existing = grouped.get(groupKey);
      if (
        !existing
        || session.completedAtDate.getTime() > existing.occurredAt.getTime()
      ) {
        grouped.set(groupKey, {
          session,
          cardId: card.cardId,
          occurredAt: session.completedAtDate,
        });
      }
    }
  }

  const result: StatisticsFlashcardFailure[] = [];
  for (const [groupKey, entry] of Array.from(grouped.entries()).sort(
    (left, right) =>
      right[1].occurredAt.getTime() - left[1].occurredAt.getTime(),
  )) {
    const { session, cardId, occurredAt } = entry;
    const cacheKey = session.flashcardSetId;
    let setMeta = setCache.get(cacheKey);
    if (!setMeta) {
      const snap = await getDoc(flashcardSetRef(userId, session.flashcardSetId));
      const data = snap.exists() ? (snap.data() ?? {}) : {};
      const cards = new Map<
        string,
        { front: string; back: string; explanation?: string }
      >();
      if (Array.isArray(data.flashcards)) {
        for (const flashcard of data.flashcards) {
          if (
            flashcard
            && typeof flashcard === 'object'
            && typeof flashcard.id === 'string'
          ) {
            cards.set(flashcard.id, {
              front: String(flashcard.front ?? ''),
              back: String(flashcard.back ?? ''),
              ...(typeof flashcard.explanation === 'string'
                ? { explanation: flashcard.explanation }
                : {}),
            });
          }
        }
      }
      setMeta = {
        title: typeof data.title === 'string' ? data.title : undefined,
        cards,
      };
      setCache.set(cacheKey, setMeta);
    }

    const cardMeta = setMeta.cards.get(cardId);
    const sourceDocuments = await getDocumentSummaries(
      userId,
      session.documentIds ?? [],
      documentCache,
    );

    result.push({
      id: groupKey,
      groupKey,
      sessionId: session.id,
      flashcardSetId: session.flashcardSetId,
      flashcardSetTitle: setMeta.title,
      cardId,
      cardFront: cardMeta?.front ?? 'Unknown card',
      cardBack: cardMeta?.back ?? '',
      ...(cardMeta?.explanation ? { cardExplanation: cardMeta.explanation } : {}),
      sourceDocuments,
      occurredAt: occurredAt.toISOString(),
      repeatedFailureCount: repeatCounts.get(groupKey) ?? 1,
    });
  }

  return result;
}

async function buildQuizPerformance(
  userId: string,
  attempts: IStoredAttempt[],
  range: StatisticsDateRangeRequest,
  hiddenKeys: Set<string> = new Set(),
): Promise<StatisticsQuizPerformanceItem[]> {
  const explanationCounts = await getExplanationCountsByQuiz(userId, range);
  const quizCache = new Map<string, IQuizMetadata>();
  const documentCache = new Map<string, StatisticsDocumentSummary>();
  const grouped = new Map<
    string,
    {
      quizId: string;
      quizType: QuizTelemetryType;
      documentIds: Set<string>;
      attemptCount: number;
      answeredQuestionCount: number;
      correctAnswerCount: number;
      incorrectAnswerCount: number;
      bestPercentage: number;
      latestPercentage: number;
      totalDurationMs: number;
      lastAttemptAt?: Date;
    }
  >();

  for (const attempt of attempts) {
    const key = `${attempt.quizType}:${attempt.quizId}`;
    const existing = grouped.get(key) ?? {
      quizId: attempt.quizId,
      quizType: attempt.quizType,
      documentIds: new Set<string>(),
      attemptCount: 0,
      answeredQuestionCount: 0,
      correctAnswerCount: 0,
      incorrectAnswerCount: 0,
      bestPercentage: 0,
      latestPercentage: 0,
      totalDurationMs: 0,
    };

    for (const docId of attempt.documentIds ?? []) {
      existing.documentIds.add(docId);
    }
    let correct = 0;
    let total = 0;
    for (const answer of attempt.answers ?? []) {
      if (
        isQuestionHidden(
          hiddenKeys,
          attempt.quizType,
          attempt.quizId,
          answer.questionIndex,
        )
      ) {
        continue;
      }
      total += 1;
      if (answer.isCorrect) correct += 1;
    }
    existing.attemptCount += 1;
    existing.answeredQuestionCount += total;
    existing.correctAnswerCount += correct;
    existing.incorrectAnswerCount += Math.max(0, total - correct);
    existing.bestPercentage = Math.max(
      existing.bestPercentage,
      attempt.percentage ?? 0,
    );
    existing.totalDurationMs += attempt.durationMs ?? 0;

    if (
      !existing.lastAttemptAt
      || attempt.completedAtDate > existing.lastAttemptAt
    ) {
      existing.lastAttemptAt = attempt.completedAtDate;
      existing.latestPercentage = attempt.percentage ?? 0;
    }

    grouped.set(key, existing);
  }

  const items: StatisticsQuizPerformanceItem[] = [];
  for (const [key, group] of grouped) {
    const metadata = await getQuizMetadata(
      userId,
      group.quizType,
      group.quizId,
      quizCache,
    );
    const sourceDocuments = await getDocumentSummaries(
      userId,
      Array.from(group.documentIds),
      documentCache,
    );

    items.push({
      id: key,
      quizId: group.quizId,
      quizType: group.quizType,
      quizTitle: metadata.title,
      sourceDocuments,
      attemptCount: group.attemptCount,
      answeredQuestionCount: group.answeredQuestionCount,
      correctAnswerCount: group.correctAnswerCount,
      incorrectAnswerCount: group.incorrectAnswerCount,
      explanationRequestCount: explanationCounts.get(key) ?? 0,
      accuracyPercentage: accuracy(
        group.correctAnswerCount,
        group.answeredQuestionCount,
      ),
      bestPercentage: group.bestPercentage,
      latestPercentage: group.latestPercentage,
      totalDurationMs: group.totalDurationMs,
      lastAttemptAt: group.lastAttemptAt?.toISOString(),
    });
  }

  return items.sort((left, right) => {
    const leftDate = left.lastAttemptAt
      ? new Date(left.lastAttemptAt).getTime()
      : 0;
    const rightDate = right.lastAttemptAt
      ? new Date(right.lastAttemptAt).getTime()
      : 0;
    return rightDate - leftDate;
  });
}

function isArtifactType(value: unknown): value is ArtifactType {
  return typeof value === 'string' && value in ARTIFACT_TYPE_LABELS;
}

function getArtifactRef(
  userId: string,
  artifactType: ArtifactType,
  artifactId: string,
) {
  switch (artifactType) {
    case 'document':
      return documentRef(userId, artifactId);
    case 'quiz':
      return quizRef(userId, artifactId);
    case 'diagramQuiz':
      return diagramQuizRef(userId, artifactId);
    case 'sequenceQuiz':
      return sequenceQuizRef(userId, artifactId);
    case 'matchQuiz':
      return matchQuizRef(userId, artifactId);
    case 'flashcardSet':
      return flashcardSetRef(userId, artifactId);
    case 'slideDeck':
      return slideDeckRef(userId, artifactId);
    default:
      return null;
  }
}

export async function buildOverviewFromAttempts(
  userId: string,
  failureAttempts: IStoredAttempt[],
  range: StatisticsDateRangeRequest,
  hiddenKeys: Set<string>,
  metricsAttempts?: IStoredAttempt[],
): Promise<Pick<GetStatisticsOverviewResponse, 'metrics' | 'recentFailures'>> {
  const explanationCounts = await getExplanationCountsByQuiz(userId, range);
  const explanationRequestCount = Array.from(explanationCounts.values()).reduce(
    (sum, count) => sum + count,
    0,
  );
  const attemptsForMetrics = metricsAttempts ?? failureAttempts;

  return {
    metrics: computeOverviewMetricsFromAttempts(
      attemptsForMetrics,
      hiddenKeys,
      explanationRequestCount,
    ),
    recentFailures: await buildGroupedFailures(userId, failureAttempts, hiddenKeys),
  };
}

export async function getStatisticsOverviewFromFirestore(
  userId: string,
  range: StatisticsDateRangeRequest,
  scope?: StatisticsScopeOptions,
): Promise<GetStatisticsOverviewResponse> {
  const hiddenKeys = await getHiddenFailureGroupKeys(userId);
  const attemptsPage = await fetchQuizAttemptsPage(userId, range, scope);
  const allAttempts = await getAttemptsForStatisticsOverview(userId, range, scope);
  const flashcardPage = await fetchFlashcardStudySessionsPage(userId, range);
  const overview = await buildOverviewFromAttempts(
    userId,
    attemptsPage.attempts,
    range,
    hiddenKeys,
    allAttempts,
  );

  return {
    ...overview,
    attempts: attemptsPage.attempts.map(serializeOverviewAttempt),
    nextAttemptCursor: attemptsPage.nextCursor,
    hasMoreAttempts: attemptsPage.hasMore,
    flashcardFailures: await buildGroupedFlashcardFailures(
      userId,
      flashcardPage.sessions,
      hiddenKeys,
    ),
    nextFlashcardCursor: flashcardPage.nextCursor,
    hasMoreFlashcardSessions: flashcardPage.hasMore,
  };
}

export async function getStatisticsQuizPerformanceFromFirestore(
  userId: string,
  range: StatisticsDateRangeRequest,
  scope?: StatisticsScopeOptions,
): Promise<GetStatisticsQuizPerformanceResponse> {
  const hiddenKeys = await getHiddenFailureGroupKeys(userId);
  const attempts = await getAttemptsForStatisticsOverview(userId, range, scope);
  return {
    quizzes: await buildQuizPerformance(userId, attempts, range, hiddenKeys),
    recentFailures: await buildGroupedFailures(userId, attempts, hiddenKeys),
  };
}

export async function getStatisticsLearningTimeFromFirestore(
  userId: string,
  range: StatisticsDateRangeRequest,
): Promise<GetStatisticsLearningTimeResponse> {
  const constraints: QueryConstraint[] = [
    ...applyDateRangeConstraints(range),
  ];
  constraints.push(orderNewestFirst(range, 'date', 'lastActiveAt'));
  constraints.push(limit(MAX_INTERACTION_SESSIONS_TO_SCAN));

  const snapshot = await getDocs(
    query(interactionSessionCollection(userId), ...constraints),
  );
  const byType = new Map<ArtifactType, StatisticsLearningTimeByType>();
  const artifacts = new Map<string, StatisticsLearningTimeArtifact>();

  for (const sessionDoc of snapshot.docs) {
    const data = sessionDoc.data();
    if (!isArtifactType(data.artifactType)) {
      continue;
    }
    const artifactType = data.artifactType;
    const artifactId = String(data.artifactId ?? 'unknown');
    const activeSeconds = Number(data.activeSeconds ?? 0);
    const typeRow = byType.get(artifactType) ?? {
      artifactType,
      totalSeconds: 0,
      sessionCount: 0,
    };
    typeRow.totalSeconds += activeSeconds;
    typeRow.sessionCount += 1;
    byType.set(artifactType, typeRow);

    const artifactKey = `${artifactType}:${artifactId}`;
    const existing = artifacts.get(artifactKey) ?? {
      id: artifactKey,
      artifactId,
      artifactType,
      title: `${ARTIFACT_TYPE_LABELS[artifactType]} ${artifactId}`,
      totalSeconds: 0,
      sessionCount: 0,
    };
    existing.totalSeconds += activeSeconds;
    existing.sessionCount += 1;
    const lastActiveAt = toIso(data.lastActiveAt);
    if (
      lastActiveAt
      && (!existing.lastActiveAt
        || new Date(lastActiveAt) > new Date(existing.lastActiveAt))
    ) {
      existing.lastActiveAt = lastActiveAt;
    }
    artifacts.set(artifactKey, existing);
  }

  const topArtifacts = Array.from(artifacts.values())
    .sort((left, right) => right.totalSeconds - left.totalSeconds)
    .slice(0, 10);

  for (const artifact of topArtifacts) {
    const artifactDocRef = getArtifactRef(
      userId,
      artifact.artifactType,
      artifact.artifactId,
    );
    if (!artifactDocRef) {
      continue;
    }
    const snap = await getDoc(artifactDocRef);
    if (snap.exists()) {
      const data = snap.data() ?? {};
      artifact.title = String(
        data.title ?? data.documentTitle ?? artifact.title,
      );
    }
  }

  return {
    totalSeconds: Array.from(byType.values()).reduce(
      (sum, row) => sum + row.totalSeconds,
      0,
    ),
    sessionCount: Array.from(byType.values()).reduce(
      (sum, row) => sum + row.sessionCount,
      0,
    ),
    byArtifactType: Array.from(byType.values()).sort(
      (left, right) => right.totalSeconds - left.totalSeconds,
    ),
    topArtifacts,
  };
}

export async function getStatisticsQuizDetailFromFirestore(
  userId: string,
  data: GetStatisticsQuizDetailRequest,
  scope?: StatisticsScopeOptions,
): Promise<GetStatisticsQuizDetailResponse> {
  const attempts = await getAttemptsForStatisticsOverview(
    userId,
    { ...data, quizType: data.quizType },
    scope,
    { quizId: data.quizId, quizType: data.quizType },
  );
  const hiddenKeys = await getHiddenFailureGroupKeys(userId);
  const quizzes = await buildQuizPerformance(userId, attempts, data, hiddenKeys);
  const failedQuestions = await buildGroupedFailures(
    userId,
    attempts,
    hiddenKeys,
    (_answer, attempt) =>
      attempt.quizId === data.quizId && attempt.quizType === data.quizType,
  );
  const detailAttempts: StatisticsQuizDetailAttempt[] = attempts.map(
    (attempt) => ({
      attemptId: attempt.id,
      completedAt: attempt.completedAtDate.toISOString(),
      score: attempt.score,
      totalQuestions: attempt.totalQuestions,
      percentage: attempt.percentage,
      durationMs: attempt.durationMs,
      incorrectAnswerCount:
        attempt.answers?.filter((answer) => !answer.isCorrect).length ?? 0,
    }),
  );

  return {
    quiz: quizzes[0] ?? null,
    attempts: detailAttempts,
    questionBreakdown: buildQuestionBreakdown(attempts, hiddenKeys),
    failedQuestions,
  };
}
