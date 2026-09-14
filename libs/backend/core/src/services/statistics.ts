import { Query, Timestamp } from 'firebase-admin/firestore';
import { FirestorePaths } from '../lib/firestore-paths';
import {
  ArtifactType,
  GetStatisticsLearningTimeResponse,
  GetStatisticsOverviewResponse,
  GetStatisticsQuizDetailRequest,
  GetStatisticsQuizDetailResponse,
  GetStatisticsQuizPerformanceResponse,
  QuestionKnowledgeMetadata,
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
  StatisticsRecentFailure,
  FlashcardStudySession,
  StatisticsFlashcardFailure,
} from '@shared-types';
import {
  flashcardFailureGroupKey,
  quizFailureGroupKey,
} from '@shared-types';

export interface StatisticsScopeOptions {
  directoryIds?: string[];
}

interface IStoredAttempt extends QuizAttempt {
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
    prompts?: Array<{ id?: string; text?: string }>;
    matchOptions?: Array<{ id?: string; text?: string }>;
  }>;
}

const ATTEMPT_PAGE_SIZE = 50;
const FLASHCARD_SESSION_PAGE_SIZE = 50;
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
    typeof value === 'object' &&
    'toDate' in value &&
    typeof value.toDate === 'function'
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

function knowledgeKeys(knowledge: QuestionKnowledgeMetadata | undefined): {
  subjectKey: string;
  knowledgeDomainKey: string;
  subjectName: string;
  knowledgeDomainName: string;
} {
  return {
    subjectKey: keyPart(knowledge?.subjectId || knowledge?.subjectName),
    knowledgeDomainKey: keyPart(
      knowledge?.knowledgeDomainId || knowledge?.knowledgeDomainName,
    ),
    subjectName: knowledge?.subjectName || 'Unclassified subject',
    knowledgeDomainName:
      knowledge?.knowledgeDomainName || 'Unclassified domain',
  };
}

function keyPart(value: string | undefined): string {
  const normalized = value?.trim();
  return normalized ? normalized.toLowerCase() : 'unclassified';
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
  if (Array.isArray(value)) {
    if (question?.matchOptions) {
      const optionsById = new Map(
        question.matchOptions
          .filter((option) => typeof option.id === 'string')
          .map((option) => [option.id as string, String(option.text ?? option.id)]),
      );
      return value
        .map((id) => optionsById.get(String(id)) ?? String(id))
        .join(' | ');
    }
    return value.join(' → ');
  }
  if (value === null || value === undefined) return 'No answer';
  if (typeof value === 'number') {
    const label =
      question?.diagramLabels?.[value] ??
      question?.options?.[value] ??
      question?.diagrams?.[value];
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

function getQuizRef(
  userId: string,
  quizType: QuizTelemetryType,
  quizId: string,
) {
  switch (quizType) {
    case 'quiz':
      return FirestorePaths.quiz(userId, quizId);
    case 'diagramQuiz':
      return FirestorePaths.diagramQuiz(userId, quizId);
    case 'sequenceQuiz':
      return FirestorePaths.sequenceQuiz(userId, quizId);
    case 'matchQuiz':
      return FirestorePaths.matchQuiz(userId, quizId);
  }
}

function getArtifactRef(
  userId: string,
  artifactType: ArtifactType,
  artifactId: string,
) {
  switch (artifactType) {
    case 'document':
      return FirestorePaths.document(userId, artifactId);
    case 'quiz':
      return FirestorePaths.quiz(userId, artifactId);
    case 'diagramQuiz':
      return FirestorePaths.diagramQuiz(userId, artifactId);
    case 'sequenceQuiz':
      return FirestorePaths.sequenceQuiz(userId, artifactId);
    case 'matchQuiz':
      return FirestorePaths.matchQuiz(userId, artifactId);
    case 'flashcardSet':
      return FirestorePaths.flashcardSet(userId, artifactId);
    case 'slideDeck':
      return FirestorePaths.slideDeck(userId, artifactId);
  }
}

async function getDocumentSummaries(
  userId: string,
  documentIds: string[],
  cache: Map<string, StatisticsDocumentSummary>,
): Promise<StatisticsDocumentSummary[]> {
  const uniqueIds = Array.from(new Set(documentIds.filter(Boolean)));
  const summaries: StatisticsDocumentSummary[] = [];

  for (const documentId of uniqueIds) {
    const cached = cache.get(documentId);
    if (cached) {
      summaries.push(cached);
      continue;
    }

    const snap = await FirestorePaths.document(userId, documentId).get();
    const title = snap.exists
      ? String(snap.data()?.title ?? 'Untitled document')
      : 'Unknown document';
    const summary = { id: documentId, title };
    cache.set(documentId, summary);
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

  const snap = await getQuizRef(userId, quizType, quizId).get();
  const data = snap.exists ? (snap.data() ?? {}) : {};
  const questions: IQuizMetadata['questions'] = Array.isArray(data.questions)
    ? data.questions.map((raw: unknown) => {
        if (!raw || typeof raw !== 'object') return {} as IQuizMetadata['questions'][number];
        const question = raw as Record<string, unknown>;
        const matchOptions =
          quizType === 'matchQuiz' && Array.isArray(question.options)
            ? (question.options as Array<{ id?: string; text?: string }>)
            : undefined;
        return {
          ...question,
          prompts: Array.isArray(question.prompts)
            ? (question.prompts as Array<{ id?: string; text?: string }>)
            : undefined,
          matchOptions,
        } as IQuizMetadata['questions'][number];
      })
    : [];
  const metadata = {
    title: typeof data.title === 'string' ? data.title : undefined,
    questions,
  } as IQuizMetadata;
  cache.set(cacheKey, metadata);
  return metadata;
}

function applyDateRange(
  query: Query,
  range: StatisticsDateRangeRequest,
  field = 'date',
): Query {
  let nextQuery = query;
  if (range.startDate)
    nextQuery = nextQuery.where(field, '>=', range.startDate);
  if (range.endDate) nextQuery = nextQuery.where(field, '<=', range.endDate);
  return nextQuery;
}

async function getAttempts(
  userId: string,
  range: StatisticsDateRangeRequest,
  scope?: StatisticsScopeOptions,
): Promise<IStoredAttempt[]> {
  let query: Query = FirestorePaths.quizAttempts(userId);
  query = applyDateRange(query, range);
  if (!range.startDate && !range.endDate) {
    query = query.orderBy('completedAt', 'desc');
  }
  query = query.limit(MAX_ATTEMPTS_TO_SCAN);

  const quizType = normalizeQuizType(range.quizType);
  const snapshot = await query.get();

  const attempts = snapshot.docs
    .map((doc) => {
      const data = { id: doc.id, ...doc.data() } as QuizAttempt;
      return {
        ...data,
        completedAtDate: toDate(data.completedAt) ?? new Date(0),
      };
    })
    .filter((attempt) => matchesQuizType(attempt, quizType))
    .filter((attempt) => matchesDirectoryScope(attempt, scope?.directoryIds))
    .sort(
      (left, right) =>
        right.completedAtDate.getTime() - left.completedAtDate.getTime(),
    );

  return dedupeAttempts(attempts);
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
  let query: Query = FirestorePaths.learningEvents(userId);
  const start = parseDay(range.startDate);
  const end = parseDay(range.endDate, true);
  if (start) query = query.where('occurredAt', '>=', Timestamp.fromDate(start));
  if (end) query = query.where('occurredAt', '<=', Timestamp.fromDate(end));
  if (!start && !end) query = query.orderBy('occurredAt', 'desc');
  query = query.limit(MAX_EVENTS_TO_SCAN);

  const quizType = normalizeQuizType(range.quizType);
  const snapshot = await query.get();
  const counts = new Map<string, number>();

  for (const doc of snapshot.docs) {
    const event = doc.data();
    if (event.eventType !== 'detailed_explanation_requested') continue;
    if (quizType !== 'all' && event.quizType !== quizType) continue;
    const key = `${event.quizType}:${event.quizId}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return counts;
}

async function getHiddenFailureGroupKeys(userId: string): Promise<Set<string>> {
  const snapshot = await FirestorePaths.statisticsHiddenFailures(userId).get();
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
      if (answer.isCorrect) correctAnswerCount += 1;
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
  const grouped = new Map<
    string,
    { attempt: IStoredAttempt; answer: QuizAttemptAnswer; occurredAt: Date }
  >();
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

  const result: StatisticsRecentFailure[] = [];
  for (const [groupKey, failure] of Array.from(grouped.entries()).sort(
    (left, right) =>
      right[1].occurredAt.getTime() - left[1].occurredAt.getTime(),
  )) {
    const { attempt, answer, occurredAt } = failure;
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
      occurredAt: occurredAt.toISOString(),
      repeatedFailureCount: repeatCounts.get(groupKey) ?? 1,
    });
  }

  return result;
}

interface IStoredFlashcardSession extends FlashcardStudySession {
  completedAtDate: Date;
}

async function buildGroupedFlashcardFailures(
  userId: string,
  sessions: IStoredFlashcardSession[],
  hiddenKeys: Set<string>,
): Promise<StatisticsFlashcardFailure[]> {
  const grouped = new Map<
    string,
    { session: IStoredFlashcardSession; cardId: string; occurredAt: Date }
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
    const snap = await FirestorePaths.flashcardSet(
      userId,
      entry.session.flashcardSetId,
    ).get();
    const data = snap.exists() ? (snap.data() ?? {}) : {};
    const cards = Array.isArray(data.flashcards) ? data.flashcards : [];
    const cardMeta = cards.find(
      (card: { id?: string }) => card.id === entry.cardId,
    );
    const documents = await getDocumentSummaries(
      userId,
      entry.session.documentIds ?? [],
      new Map(),
    );

    result.push({
      id: groupKey,
      groupKey,
      sessionId: entry.session.id,
      flashcardSetId: entry.session.flashcardSetId,
      flashcardSetTitle:
        typeof data.title === 'string' ? data.title : undefined,
      cardId: entry.cardId,
      cardFront: String(cardMeta?.front ?? 'Unknown card'),
      cardBack: String(cardMeta?.back ?? ''),
      ...(typeof cardMeta?.explanation === 'string'
        ? { cardExplanation: cardMeta.explanation }
        : {}),
      sourceDocuments: documents,
      occurredAt: entry.occurredAt.toISOString(),
      repeatedFailureCount: repeatCounts.get(groupKey) ?? 1,
    });
  }

  return result;
}

async function fetchFlashcardStudySessionsPage(
  userId: string,
  range: StatisticsDateRangeRequest,
  pageSize = FLASHCARD_SESSION_PAGE_SIZE,
): Promise<IStoredFlashcardSession[]> {
  let query: Query = FirestorePaths.flashcardStudySessions(userId);
  query = applyDateRange(query, range);
  if (!range.startDate && !range.endDate) {
    query = query.orderBy('completedAt', 'desc');
  }
  query = query.limit(pageSize);

  const snapshot = await query.get();
  return snapshot.docs.map((sessionDoc) => {
    const data = {
      id: sessionDoc.id,
      ...sessionDoc.data(),
    } as FlashcardStudySession;
    return {
      ...data,
      completedAtDate: toDate(data.completedAt) ?? new Date(0),
    };
  });
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

    for (const documentId of attempt.documentIds ?? [])
      existing.documentIds.add(documentId);
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
      !existing.lastAttemptAt ||
      attempt.completedAtDate > existing.lastAttemptAt
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

export async function getStatisticsOverview(
  userId: string,
  range: StatisticsDateRangeRequest,
  scope?: StatisticsScopeOptions,
): Promise<GetStatisticsOverviewResponse> {
  const hiddenKeys = await getHiddenFailureGroupKeys(userId);
  const attempts = await getAttempts(userId, range, scope);
  const flashcardSessions = await fetchFlashcardStudySessionsPage(userId, range);
  const explanationCounts = await getExplanationCountsByQuiz(userId, range);
  const explanationRequestCount = Array.from(explanationCounts.values()).reduce(
    (sum, count) => sum + count,
    0,
  );

  return {
    metrics: computeOverviewMetricsFromAttempts(
      attempts,
      hiddenKeys,
      explanationRequestCount,
    ),
    recentFailures: await buildGroupedFailures(userId, attempts, hiddenKeys),
    attempts,
    hasMoreAttempts: attempts.length >= ATTEMPT_PAGE_SIZE,
    flashcardFailures: await buildGroupedFlashcardFailures(
      userId,
      flashcardSessions,
      hiddenKeys,
    ),
    hasMoreFlashcardSessions:
      flashcardSessions.length >= FLASHCARD_SESSION_PAGE_SIZE,
  };
}

export async function getStatisticsQuizPerformance(
  userId: string,
  range: StatisticsDateRangeRequest,
  scope?: StatisticsScopeOptions,
): Promise<GetStatisticsQuizPerformanceResponse> {
  const hiddenKeys = await getHiddenFailureGroupKeys(userId);
  const attempts = await getAttempts(userId, range, scope);
  return {
    quizzes: await buildQuizPerformance(userId, attempts, range, hiddenKeys),
    recentFailures: await buildGroupedFailures(userId, attempts, hiddenKeys),
  };
}

export async function getStatisticsLearningTime(
  userId: string,
  range: StatisticsDateRangeRequest,
): Promise<GetStatisticsLearningTimeResponse> {
  let query: Query = FirestorePaths.interactionSessions(userId);
  query = applyDateRange(query, range);
  if (!range.startDate && !range.endDate) {
    query = query.orderBy('lastActiveAt', 'desc');
  }
  query = query.limit(MAX_INTERACTION_SESSIONS_TO_SCAN);
  const snapshot = await query.get();
  const byType = new Map<ArtifactType, StatisticsLearningTimeByType>();
  const artifacts = new Map<string, StatisticsLearningTimeArtifact>();

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const artifactType = data.artifactType as ArtifactType;
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
      lastActiveAt &&
      (!existing.lastActiveAt ||
        new Date(lastActiveAt) > new Date(existing.lastActiveAt))
    ) {
      existing.lastActiveAt = lastActiveAt;
    }
    artifacts.set(artifactKey, existing);
  }

  const topArtifacts = Array.from(artifacts.values())
    .sort((left, right) => right.totalSeconds - left.totalSeconds)
    .slice(0, 10);

  for (const artifact of topArtifacts) {
    const snap = await getArtifactRef(
      userId,
      artifact.artifactType,
      artifact.artifactId,
    ).get();
    if (snap.exists) {
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

export async function getStatisticsQuizDetail(
  userId: string,
  data: GetStatisticsQuizDetailRequest,
  scope?: StatisticsScopeOptions,
): Promise<GetStatisticsQuizDetailResponse> {
  const attempts = (
    await getAttempts(userId, { ...data, quizType: data.quizType }, scope)
  ).filter(
    (attempt) =>
      attempt.quizId === data.quizId && attempt.quizType === data.quizType,
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
    questionBreakdown: buildQuestionBreakdown(attempts),
    failedQuestions,
  };
}
