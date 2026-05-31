import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { FirestorePaths } from '../lib/firestore-paths';
import {
  DiagramQuiz,
  DiagramQuizQuestion,
  QuestionKnowledgeMetadata,
  Quiz,
  QuizAnswerValue,
  QuizAttemptAnswer,
  QuizQuestion,
  QuizStatsSummary,
  QuizTelemetryType,
  RecordQuizAttemptAnswerInput,
  RecordQuizAttemptRequest,
  RecordQuizExplanationRequest,
  SequenceQuiz,
  SequenceQuizQuestion,
} from '../../libs/shared-types/src/index';

type StoredQuiz = Quiz | DiagramQuiz | SequenceQuiz;
type StoredQuestion = QuizQuestion | DiagramQuizQuestion | SequenceQuizQuestion;

interface IResolvedQuiz {
  quiz: StoredQuiz;
  questions: StoredQuestion[];
  documentIds: string[];
}

const QUIZ_STAT_ZEROES = {
  attemptCount: 0,
  totalScore: 0,
  totalPercentage: 0,
  totalDurationMs: 0,
  bestScore: 0,
  bestPercentage: 0,
  latestScore: 0,
  latestPercentage: 0,
  incorrectAnswerCount: 0,
  explanationRequestCount: 0,
};

function statId(...parts: Array<string | number | undefined>): string {
  return parts
    .map((part) => encodeURIComponent(String(part ?? 'unclassified').trim() || 'unclassified'))
    .join('__');
}

function parseDate(value: string | undefined, fieldName: string): Date {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${fieldName} must be a valid ISO date string`);
  }
  return date;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];
}

function getQuizRef(userId: string, quizType: QuizTelemetryType, quizId: string) {
  switch (quizType) {
    case 'quiz':
      return FirestorePaths.quiz(userId, quizId);
    case 'diagramQuiz':
      return FirestorePaths.diagramQuiz(userId, quizId);
    case 'sequenceQuiz':
      return FirestorePaths.sequenceQuiz(userId, quizId);
    default:
      throw new Error(`Unsupported quiz type: ${quizType}`);
  }
}

async function resolveQuiz(
  userId: string,
  quizType: QuizTelemetryType,
  quizId: string
): Promise<IResolvedQuiz> {
  const snap = await getQuizRef(userId, quizType, quizId).get();
  if (!snap.exists) {
    throw new Error('Quiz not found');
  }

  const quiz = { id: snap.id, ...snap.data() } as StoredQuiz;
  const questions = (quiz.questions ?? []) as StoredQuestion[];
  const documentIds = stringArray(quiz.documentIds).length > 0
    ? stringArray(quiz.documentIds)
    : stringArray([quiz.documentId]);

  return { quiz, questions, documentIds };
}

function normalizeKnowledge(
  question: StoredQuestion,
  fallbackDocumentIds: string[]
): QuestionKnowledgeMetadata {
  const source = question.knowledge ?? {};
  const sourceDocumentIds = stringArray(source.sourceDocumentIds).length > 0
    ? stringArray(source.sourceDocumentIds)
    : fallbackDocumentIds;

  return {
    ...(source.subjectId ? { subjectId: source.subjectId } : {}),
    ...(source.subjectName ? { subjectName: source.subjectName } : {}),
    ...(source.knowledgeDomainId ? { knowledgeDomainId: source.knowledgeDomainId } : {}),
    ...(source.knowledgeDomainName ? { knowledgeDomainName: source.knowledgeDomainName } : {}),
    topicTags: stringArray(source.topicTags),
    sourceDocumentIds,
  };
}

function isSequenceQuestion(question: StoredQuestion): question is SequenceQuizQuestion {
  return 'items' in question;
}

function selectedNumber(value: QuizAnswerValue): number | null {
  return typeof value === 'number' && Number.isInteger(value) ? value : null;
}

function arraysEqual(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

function resolveAnswer(
  question: StoredQuestion,
  input: RecordQuizAttemptAnswerInput,
): Pick<QuizAttemptAnswer, 'selectedAnswer' | 'correctAnswer' | 'isCorrect'> {
  if (isSequenceQuestion(question)) {
    const selectedAnswer = stringArray(input.selectedAnswer);
    return {
      selectedAnswer,
      correctAnswer: question.items,
      isCorrect: arraysEqual(selectedAnswer, question.items),
    };
  }

  const selectedAnswer = selectedNumber(input.selectedAnswer);
  return {
    selectedAnswer,
    correctAnswer: question.correctAnswer,
    isCorrect: selectedAnswer === question.correctAnswer,
  };
}

function buildAttemptAnswers(
  resolved: IResolvedQuiz,
  inputs: RecordQuizAttemptAnswerInput[],
): QuizAttemptAnswer[] {
  return inputs.map((input) => {
    const question = resolved.questions[input.questionIndex];
    if (!question) {
      throw new Error(`Question index ${input.questionIndex} is out of range`);
    }

    const answer = resolveAnswer(question, input);
    const requestedAt = input.detailedExplanationRequestedAt
      ? Timestamp.fromDate(parseDate(input.detailedExplanationRequestedAt, 'detailedExplanationRequestedAt'))
      : undefined;

    return {
      questionIndex: input.questionIndex,
      questionText: question.question,
      ...answer,
      ...(input.timeSpentMs !== undefined ? { timeSpentMs: Math.max(0, input.timeSpentMs) } : {}),
      knowledge: normalizeKnowledge(question, resolved.documentIds),
      detailedExplanationRequested: Boolean(input.detailedExplanationRequested),
      ...(requestedAt ? { detailedExplanationRequestedAt: requestedAt } : {}),
    };
  });
}

function knowledgeStatPayload(
  userId: string,
  date: string,
  knowledge: QuestionKnowledgeMetadata,
  increments: {
    answerCount?: number;
    correctCount?: number;
    incorrectCount?: number;
    explanationRequestCount?: number;
  }
): Record<string, unknown> {
  return {
    userId,
    date,
    ...(knowledge.subjectId ? { subjectId: knowledge.subjectId } : {}),
    ...(knowledge.subjectName ? { subjectName: knowledge.subjectName } : {}),
    ...(knowledge.knowledgeDomainId ? { knowledgeDomainId: knowledge.knowledgeDomainId } : {}),
    ...(knowledge.knowledgeDomainName ? { knowledgeDomainName: knowledge.knowledgeDomainName } : {}),
    topicTags: knowledge.topicTags ?? [],
    answerCount: FieldValue.increment(increments.answerCount ?? 0),
    correctCount: FieldValue.increment(increments.correctCount ?? 0),
    incorrectCount: FieldValue.increment(increments.incorrectCount ?? 0),
    explanationRequestCount: FieldValue.increment(increments.explanationRequestCount ?? 0),
    updatedAt: FieldValue.serverTimestamp(),
  };
}

function knowledgeStatId(date: string, knowledge: QuestionKnowledgeMetadata): string {
  return statId(
    date,
    knowledge.knowledgeDomainId || knowledge.knowledgeDomainName,
    knowledge.subjectId || knowledge.subjectName,
  );
}

function questionStatPayload(
  userId: string,
  quizId: string,
  quizType: QuizTelemetryType,
  answer: QuizAttemptAnswer,
  increments: {
    answerCount?: number;
    correctCount?: number;
    incorrectCount?: number;
    explanationRequestCount?: number;
  }
): Record<string, unknown> {
  return {
    userId,
    quizId,
    quizType,
    questionIndex: answer.questionIndex,
    questionText: answer.questionText,
    knowledge: answer.knowledge,
    answerCount: FieldValue.increment(increments.answerCount ?? 0),
    correctCount: FieldValue.increment(increments.correctCount ?? 0),
    incorrectCount: FieldValue.increment(increments.incorrectCount ?? 0),
    explanationRequestCount: FieldValue.increment(increments.explanationRequestCount ?? 0),
    updatedAt: FieldValue.serverTimestamp(),
  };
}

export async function recordQuizAttempt(
  userId: string,
  data: RecordQuizAttemptRequest,
): Promise<string> {
  if (!data.quizId || !data.quizType) {
    throw new Error('quizId and quizType are required');
  }

  const startedAt = parseDate(data.startedAt, 'startedAt');
  const completedAt = parseDate(data.completedAt, 'completedAt');
  const date = completedAt.toISOString().slice(0, 10);
  const resolved = await resolveQuiz(userId, data.quizType, data.quizId);
  const answers = buildAttemptAnswers(resolved, data.answers ?? []);
  const score = answers.filter((answer) => answer.isCorrect).length;
  const totalQuestions = resolved.questions.length;
  const percentage = totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0;
  const incorrectAnswerCount = answers.filter((answer) => !answer.isCorrect).length;
  const durationMs = Math.max(0, data.durationMs || 0);

  const attemptRef = FirestorePaths.quizAttempts(userId).doc();
  const eventRef = FirestorePaths.learningEvents(userId).doc();
  const quizStatRef = FirestorePaths.quizStat(userId, statId(data.quizType, data.quizId));
  const db = FirestorePaths.quizAttempts(userId).firestore;

  await db.runTransaction(async (transaction) => {
    const quizStatSnap = await transaction.get(quizStatRef);
    const existingStats = quizStatSnap.exists ? quizStatSnap.data() as Partial<QuizStatsSummary> : {};
    const bestScore = Math.max(existingStats.bestScore ?? 0, score);
    const bestPercentage = Math.max(existingStats.bestPercentage ?? 0, percentage);

    transaction.set(attemptRef, {
      id: attemptRef.id,
      userId,
      quizId: data.quizId,
      quizType: data.quizType,
      documentIds: resolved.documentIds,
      directoryId: resolved.quiz.directoryId,
      startedAt: Timestamp.fromDate(startedAt),
      completedAt: Timestamp.fromDate(completedAt),
      durationMs,
      score,
      totalQuestions,
      percentage,
      answers,
      date,
    });

    transaction.set(eventRef, {
      id: eventRef.id,
      userId,
      eventType: 'quiz_attempt_completed',
      quizId: data.quizId,
      quizType: data.quizType,
      occurredAt: Timestamp.fromDate(completedAt),
    });

    transaction.set(quizStatRef, {
      userId,
      quizId: data.quizId,
      quizType: data.quizType,
      directoryId: resolved.quiz.directoryId,
      documentIds: resolved.documentIds,
      totalQuestions,
      attemptCount: FieldValue.increment(1),
      totalScore: FieldValue.increment(score),
      totalPercentage: FieldValue.increment(percentage),
      totalDurationMs: FieldValue.increment(durationMs),
      bestScore,
      bestPercentage,
      latestScore: score,
      latestPercentage: percentage,
      incorrectAnswerCount: FieldValue.increment(incorrectAnswerCount),
      explanationRequestCount: FieldValue.increment(0),
      lastAttemptAt: Timestamp.fromDate(completedAt),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    for (const answer of answers) {
      const answerEventRef = FirestorePaths.learningEvents(userId).doc();
      const questionStatRef = FirestorePaths.questionStat(
        userId,
        statId(data.quizType, data.quizId, answer.questionIndex)
      );
      const knowledgeRef = FirestorePaths.knowledgeStat(userId, knowledgeStatId(date, answer.knowledge));

      transaction.set(answerEventRef, {
        id: answerEventRef.id,
        userId,
        eventType: 'question_answered',
        quizId: data.quizId,
        quizType: data.quizType,
        questionIndex: answer.questionIndex,
        isCorrect: answer.isCorrect,
        knowledge: answer.knowledge,
        occurredAt: Timestamp.fromDate(completedAt),
      });

      transaction.set(questionStatRef, questionStatPayload(userId, data.quizId, data.quizType, answer, {
        answerCount: 1,
        correctCount: answer.isCorrect ? 1 : 0,
        incorrectCount: answer.isCorrect ? 0 : 1,
      }), { merge: true });

      transaction.set(knowledgeRef, knowledgeStatPayload(userId, date, answer.knowledge, {
        answerCount: 1,
        correctCount: answer.isCorrect ? 1 : 0,
        incorrectCount: answer.isCorrect ? 0 : 1,
      }), { merge: true });
    }
  });

  return attemptRef.id;
}

export async function recordQuizExplanationRequest(
  userId: string,
  data: RecordQuizExplanationRequest,
): Promise<string> {
  if (!data.quizId || !data.quizType || data.questionIndex < 0) {
    throw new Error('quizId, quizType, and questionIndex are required');
  }

  const requestedAt = parseDate(data.requestedAt, 'requestedAt');
  const date = requestedAt.toISOString().slice(0, 10);
  const resolved = await resolveQuiz(userId, data.quizType, data.quizId);
  const question = resolved.questions[data.questionIndex];
  if (!question) {
    throw new Error(`Question index ${data.questionIndex} is out of range`);
  }

  const knowledge = normalizeKnowledge(question, resolved.documentIds);
  const eventRef = FirestorePaths.learningEvents(userId).doc();
  const quizStatRef = FirestorePaths.quizStat(userId, statId(data.quizType, data.quizId));
  const questionStatRef = FirestorePaths.questionStat(
    userId,
    statId(data.quizType, data.quizId, data.questionIndex)
  );
  const knowledgeRef = FirestorePaths.knowledgeStat(userId, knowledgeStatId(date, knowledge));

  const batch = FirestorePaths.learningEvents(userId).firestore.batch();
  batch.set(eventRef, {
    id: eventRef.id,
    userId,
    eventType: 'detailed_explanation_requested',
    quizId: data.quizId,
    quizType: data.quizType,
    questionIndex: data.questionIndex,
    knowledge,
    occurredAt: Timestamp.fromDate(requestedAt),
  });
  batch.set(quizStatRef, {
    userId,
    quizId: data.quizId,
    quizType: data.quizType,
    directoryId: resolved.quiz.directoryId,
    documentIds: resolved.documentIds,
    totalQuestions: resolved.questions.length,
    explanationRequestCount: FieldValue.increment(1),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  batch.set(questionStatRef, questionStatPayload(userId, data.quizId, data.quizType, {
    questionIndex: data.questionIndex,
    questionText: question.question,
    selectedAnswer: null,
    correctAnswer: null,
    isCorrect: false,
    knowledge,
    detailedExplanationRequested: true,
  }, { explanationRequestCount: 1 }), { merge: true });
  batch.set(knowledgeRef, knowledgeStatPayload(userId, date, knowledge, {
    explanationRequestCount: 1,
  }), { merge: true });

  await batch.commit();
  return eventRef.id;
}

export async function getQuizStats(
  userId: string,
  quizType: QuizTelemetryType,
  quizId: string,
): Promise<QuizStatsSummary | null> {
  const snap = await FirestorePaths.quizStat(userId, statId(quizType, quizId)).get();
  if (!snap.exists) {
    return null;
  }

  const data = snap.data() as Partial<QuizStatsSummary>;
  return {
    id: snap.id,
    userId,
    quizId,
    quizType,
    directoryId: data.directoryId ?? '',
    documentIds: data.documentIds ?? [],
    totalQuestions: data.totalQuestions ?? 0,
    ...QUIZ_STAT_ZEROES,
    ...data,
    updatedAt: data.updatedAt ?? new Date(),
  } as QuizStatsSummary;
}