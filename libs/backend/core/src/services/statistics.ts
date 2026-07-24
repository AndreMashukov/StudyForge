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
  StatisticsQuizDetailAttempt,
  StatisticsQuizPerformanceItem,
  StatisticsQuizTypeFilter,
  StatisticsRecentFailure,
} from '@shared-types';

interface IStoredAttempt extends QuizAttempt {
  completedAtDate: Date;
}

interface IQuizMetadata {
  title?: string;
  questions: Array<{
    question?: string;
    options?: string[];
    diagrams?: string[];
    diagramLabels?: string[];
    items?: string[];
  }>;
}

const DEFAULT_RECENT_FAILURE_LIMIT = 10;
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
  subjectWorld: 'Subject world',
};

function normalizeQuizType(value: StatisticsQuizTypeFilter | undefined): StatisticsQuizTypeFilter {
  return value ?? 'all';
}

function parseDay(value: string | undefined, endOfDay = false): Date | null {
  if (!value) return null;
  const date = new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (value instanceof Timestamp) return value.toDate();
  if (typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
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
    knowledgeDomainKey: keyPart(knowledge?.knowledgeDomainId || knowledge?.knowledgeDomainName),
    subjectName: knowledge?.subjectName || 'Unclassified subject',
    knowledgeDomainName: knowledge?.knowledgeDomainName || 'Unclassified domain',
  };
}

function keyPart(value: string | undefined): string {
  const normalized = value?.trim();
  return normalized ? normalized.toLowerCase() : 'unclassified';
}

function matchesQuizType(attempt: QuizAttempt, quizType: StatisticsQuizTypeFilter): boolean {
  return quizType === 'all' || attempt.quizType === quizType;
}

function sourceDocumentIds(answer: QuizAttemptAnswer, attempt: QuizAttempt): string[] {
  const answerSources = answer.knowledge?.sourceDocumentIds ?? [];
  return answerSources.length > 0 ? answerSources : attempt.documentIds ?? [];
}

function answerLabel(value: QuizAnswerValue, question?: IQuizMetadata['questions'][number]): string {
  if (Array.isArray(value)) return value.join(' → ');
  if (value === null || value === undefined) return 'No answer';
  if (typeof value === 'number') {
    const label = question?.diagramLabels?.[value] ?? question?.options?.[value] ?? question?.diagrams?.[value];
    return label ? String(label) : `Option ${value + 1}`;
  }
  return String(value);
}

function diagramCodeAt(
  question: IQuizMetadata['questions'][number] | undefined,
  value: QuizAnswerValue
): string | undefined {
  if (typeof value !== 'number' || value < 0) return undefined;
  const code = question?.diagrams?.[value];
  return typeof code === 'string' && code.trim().length > 0 ? code : undefined;
}

function getQuizRef(userId: string, quizType: QuizTelemetryType, quizId: string) {
  switch (quizType) {
    case 'quiz':
      return FirestorePaths.quiz(userId, quizId);
    case 'diagramQuiz':
      return FirestorePaths.diagramQuiz(userId, quizId);
    case 'sequenceQuiz':
      return FirestorePaths.sequenceQuiz(userId, quizId);
  }
}

function getArtifactRef(userId: string, artifactType: ArtifactType, artifactId: string) {
  switch (artifactType) {
    case 'document':
      return FirestorePaths.document(userId, artifactId);
    case 'quiz':
      return FirestorePaths.quiz(userId, artifactId);
    case 'diagramQuiz':
      return FirestorePaths.diagramQuiz(userId, artifactId);
    case 'sequenceQuiz':
      return FirestorePaths.sequenceQuiz(userId, artifactId);
    case 'flashcardSet':
      return FirestorePaths.flashcardSet(userId, artifactId);
    case 'slideDeck':
      return FirestorePaths.slideDeck(userId, artifactId);
    case 'subjectWorld':
      return FirestorePaths.subjectWorld(userId, artifactId);
  }
}

async function getDocumentSummaries(
  userId: string,
  documentIds: string[],
  cache: Map<string, StatisticsDocumentSummary>
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
    const title = snap.exists ? String(snap.data()?.title ?? 'Untitled document') : 'Unknown document';
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
  cache: Map<string, IQuizMetadata>
): Promise<IQuizMetadata> {
  const cacheKey = `${quizType}:${quizId}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const snap = await getQuizRef(userId, quizType, quizId).get();
  const data = snap.exists ? snap.data() ?? {} : {};
  const metadata = {
    title: typeof data.title === 'string' ? data.title : undefined,
    questions: Array.isArray(data.questions) ? data.questions : [],
  } as IQuizMetadata;
  cache.set(cacheKey, metadata);
  return metadata;
}

function applyDateRange(query: Query, range: StatisticsDateRangeRequest, field = 'date'): Query {
  let nextQuery = query;
  if (range.startDate) nextQuery = nextQuery.where(field, '>=', range.startDate);
  if (range.endDate) nextQuery = nextQuery.where(field, '<=', range.endDate);
  return nextQuery;
}

async function getAttempts(userId: string, range: StatisticsDateRangeRequest): Promise<IStoredAttempt[]> {
  let query: Query = FirestorePaths.quizAttempts(userId);
  query = applyDateRange(query, range);
  if (!range.startDate && !range.endDate) {
    query = query.orderBy('completedAt', 'desc');
  }
  query = query.limit(MAX_ATTEMPTS_TO_SCAN);

  const quizType = normalizeQuizType(range.quizType);
  const snapshot = await query.get();

  return snapshot.docs
    .map((doc) => {
      const data = { id: doc.id, ...doc.data() } as QuizAttempt;
      return {
        ...data,
        completedAtDate: toDate(data.completedAt) ?? new Date(0),
      };
    })
    .filter((attempt) => matchesQuizType(attempt, quizType))
    .sort((left, right) => right.completedAtDate.getTime() - left.completedAtDate.getTime());
}

async function getExplanationCountsByQuiz(
  userId: string,
  range: StatisticsDateRangeRequest
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

async function buildRecentFailures(
  userId: string,
  attempts: IStoredAttempt[],
  limit = DEFAULT_RECENT_FAILURE_LIMIT,
  filter?: (answer: QuizAttemptAnswer, attempt: IStoredAttempt) => boolean
): Promise<StatisticsRecentFailure[]> {
  const quizCache = new Map<string, IQuizMetadata>();
  const documentCache = new Map<string, StatisticsDocumentSummary>();
  const repeatedCounts = new Map<string, number>();
  const failures: Array<{ attempt: IStoredAttempt; answer: QuizAttemptAnswer }> = [];

  for (const attempt of attempts) {
    for (const answer of attempt.answers ?? []) {
      if (answer.isCorrect || (filter && !filter(answer, attempt))) continue;
      const keys = knowledgeKeys(answer.knowledge);
      const failureKey = `${attempt.quizType}:${attempt.quizId}:${answer.questionIndex}:${keys.subjectKey}:${keys.knowledgeDomainKey}`;
      repeatedCounts.set(failureKey, (repeatedCounts.get(failureKey) ?? 0) + 1);
      failures.push({ attempt, answer });
    }
  }

  const recent = failures
    .sort((left, right) => right.attempt.completedAtDate.getTime() - left.attempt.completedAtDate.getTime())
    .slice(0, limit);

  const result: StatisticsRecentFailure[] = [];
  for (const failure of recent) {
    const { attempt, answer } = failure;
    const metadata = await getQuizMetadata(userId, attempt.quizType, attempt.quizId, quizCache);
    const question = metadata.questions[answer.questionIndex];
    const keys = knowledgeKeys(answer.knowledge);
    const failureKey = `${attempt.quizType}:${attempt.quizId}:${answer.questionIndex}:${keys.subjectKey}:${keys.knowledgeDomainKey}`;
    const documents = await getDocumentSummaries(userId, sourceDocumentIds(answer, attempt), documentCache);

    const selectedDiagramCode =
      attempt.quizType === 'diagramQuiz' ? diagramCodeAt(question, answer.selectedAnswer) : undefined;
    const correctDiagramCode =
      attempt.quizType === 'diagramQuiz' ? diagramCodeAt(question, answer.correctAnswer) : undefined;

    result.push({
      id: `${attempt.id}:${answer.questionIndex}`,
      attemptId: attempt.id,
      quizId: attempt.quizId,
      quizType: attempt.quizType,
      quizTitle: metadata.title,
      questionIndex: answer.questionIndex,
      questionText: answer.questionText,
      selectedAnswer: answer.selectedAnswer,
      selectedAnswerLabel: answerLabel(answer.selectedAnswer, question),
      correctAnswer: answer.correctAnswer,
      correctAnswerLabel: answerLabel(answer.correctAnswer, question),
      ...(selectedDiagramCode ? { selectedDiagramCode } : {}),
      ...(correctDiagramCode ? { correctDiagramCode } : {}),
      knowledge: answer.knowledge,
      sourceDocuments: documents,
      occurredAt: attempt.completedAtDate.toISOString(),
      repeatedFailureCount: repeatedCounts.get(failureKey) ?? 1,
    });
  }

  return result;
}

async function buildQuizPerformance(
  userId: string,
  attempts: IStoredAttempt[],
  range: StatisticsDateRangeRequest
): Promise<StatisticsQuizPerformanceItem[]> {
  const explanationCounts = await getExplanationCountsByQuiz(userId, range);
  const quizCache = new Map<string, IQuizMetadata>();
  const documentCache = new Map<string, StatisticsDocumentSummary>();
  const grouped = new Map<string, {
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
  }>();

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

    for (const documentId of attempt.documentIds ?? []) existing.documentIds.add(documentId);
    const correct = attempt.answers?.filter((answer) => answer.isCorrect).length ?? attempt.score ?? 0;
    const total = attempt.answers?.length ?? attempt.totalQuestions ?? 0;
    existing.attemptCount += 1;
    existing.answeredQuestionCount += total;
    existing.correctAnswerCount += correct;
    existing.incorrectAnswerCount += Math.max(0, total - correct);
    existing.bestPercentage = Math.max(existing.bestPercentage, attempt.percentage ?? 0);
    existing.totalDurationMs += attempt.durationMs ?? 0;

    if (!existing.lastAttemptAt || attempt.completedAtDate > existing.lastAttemptAt) {
      existing.lastAttemptAt = attempt.completedAtDate;
      existing.latestPercentage = attempt.percentage ?? 0;
    }

    grouped.set(key, existing);
  }

  const items: StatisticsQuizPerformanceItem[] = [];
  for (const [key, group] of grouped) {
    const metadata = await getQuizMetadata(userId, group.quizType, group.quizId, quizCache);
    const sourceDocuments = await getDocumentSummaries(userId, Array.from(group.documentIds), documentCache);

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
      accuracyPercentage: accuracy(group.correctAnswerCount, group.answeredQuestionCount),
      bestPercentage: group.bestPercentage,
      latestPercentage: group.latestPercentage,
      totalDurationMs: group.totalDurationMs,
      lastAttemptAt: group.lastAttemptAt?.toISOString(),
    });
  }

  return items.sort((left, right) => {
    const leftDate = left.lastAttemptAt ? new Date(left.lastAttemptAt).getTime() : 0;
    const rightDate = right.lastAttemptAt ? new Date(right.lastAttemptAt).getTime() : 0;
    return rightDate - leftDate;
  });
}

export async function getStatisticsOverview(
  userId: string,
  range: StatisticsDateRangeRequest
): Promise<GetStatisticsOverviewResponse> {
  const attempts = await getAttempts(userId, range);
  const recentFailures = await buildRecentFailures(userId, attempts);
  const quizCount = new Set(attempts.map((attempt) => `${attempt.quizType}:${attempt.quizId}`)).size;
  const explanationCounts = await getExplanationCountsByQuiz(userId, range);
  const explanationRequestCount = Array.from(explanationCounts.values()).reduce((sum, count) => sum + count, 0);
  const answeredQuestionCount = attempts.reduce((sum, attempt) => sum + (attempt.answers?.length ?? attempt.totalQuestions ?? 0), 0);
  const correctAnswerCount = attempts.reduce(
    (sum, attempt) => sum + (attempt.answers?.filter((answer) => answer.isCorrect).length ?? attempt.score ?? 0),
    0
  );
  const incorrectAnswerCount = Math.max(0, answeredQuestionCount - correctAnswerCount);

  return {
    metrics: {
      attemptCount: attempts.length,
      quizCount,
      answeredQuestionCount,
      correctAnswerCount,
      incorrectAnswerCount,
      explanationRequestCount,
      accuracyPercentage: accuracy(correctAnswerCount, answeredQuestionCount),
    },
    recentFailures,
  };
}

export async function getStatisticsQuizPerformance(
  userId: string,
  range: StatisticsDateRangeRequest
): Promise<GetStatisticsQuizPerformanceResponse> {
  const attempts = await getAttempts(userId, range);
  return {
    quizzes: await buildQuizPerformance(userId, attempts, range),
    recentFailures: await buildRecentFailures(userId, attempts),
  };
}

export async function getStatisticsLearningTime(
  userId: string,
  range: StatisticsDateRangeRequest
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
    const typeRow = byType.get(artifactType) ?? { artifactType, totalSeconds: 0, sessionCount: 0 };
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
    if (lastActiveAt && (!existing.lastActiveAt || new Date(lastActiveAt) > new Date(existing.lastActiveAt))) {
      existing.lastActiveAt = lastActiveAt;
    }
    artifacts.set(artifactKey, existing);
  }

  const topArtifacts = Array.from(artifacts.values())
    .sort((left, right) => right.totalSeconds - left.totalSeconds)
    .slice(0, 10);

  for (const artifact of topArtifacts) {
    const snap = await getArtifactRef(userId, artifact.artifactType, artifact.artifactId).get();
    if (snap.exists) {
      const data = snap.data() ?? {};
      artifact.title = String(data.title ?? data.documentTitle ?? artifact.title);
    }
  }

  return {
    totalSeconds: Array.from(byType.values()).reduce((sum, row) => sum + row.totalSeconds, 0),
    sessionCount: Array.from(byType.values()).reduce((sum, row) => sum + row.sessionCount, 0),
    byArtifactType: Array.from(byType.values()).sort((left, right) => right.totalSeconds - left.totalSeconds),
    topArtifacts,
  };
}

export async function getStatisticsQuizDetail(
  userId: string,
  data: GetStatisticsQuizDetailRequest
): Promise<GetStatisticsQuizDetailResponse> {
  const attempts = (await getAttempts(userId, { ...data, quizType: data.quizType }))
    .filter((attempt) => attempt.quizId === data.quizId && attempt.quizType === data.quizType);
  const quizzes = await buildQuizPerformance(userId, attempts, data);
  const failedQuestions = await buildRecentFailures(userId, attempts, 25);
  const detailAttempts: StatisticsQuizDetailAttempt[] = attempts.map((attempt) => ({
    attemptId: attempt.id,
    completedAt: attempt.completedAtDate.toISOString(),
    score: attempt.score,
    totalQuestions: attempt.totalQuestions,
    percentage: attempt.percentage,
    durationMs: attempt.durationMs,
    incorrectAnswerCount: attempt.answers?.filter((answer) => !answer.isCorrect).length ?? 0,
  }));

  return {
    quiz: quizzes[0] ?? null,
    attempts: detailAttempts,
    failedQuestions,
  };
}