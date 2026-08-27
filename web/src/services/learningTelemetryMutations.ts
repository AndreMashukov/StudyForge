import {
  doc,
  getDoc,
  increment,
  runTransaction,
  serverTimestamp,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import type {
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
} from '@shared-types';
import { db } from '../config/firebase';
import { computeExpiresAt } from './firestoreTtl';
import {
  diagramQuizRef,
  knowledgeStatRef,
  learningEventCollection,
  questionStatRef,
  quizAttemptCollection,
  quizRef,
  quizStatRef,
  sequenceQuizRef,
} from './firestorePaths';

type StoredQuiz = Quiz | DiagramQuiz | SequenceQuiz;
type StoredQuestion = QuizQuestion | DiagramQuizQuestion | SequenceQuizQuestion;

interface IResolvedQuiz {
  quiz: StoredQuiz;
  questions: StoredQuestion[];
  documentIds: string[];
}

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

async function resolveQuiz(
  userId: string,
  quizType: QuizTelemetryType,
  quizId: string,
): Promise<IResolvedQuiz> {
  const quizDocRef =
    quizType === 'quiz'
      ? quizRef(userId, quizId)
      : quizType === 'diagramQuiz'
        ? diagramQuizRef(userId, quizId)
        : sequenceQuizRef(userId, quizId);

  const snap = await getDoc(quizDocRef);
  if (!snap.exists()) {
    throw new Error('Quiz not found');
  }

  const quiz = { id: snap.id, ...snap.data() } as StoredQuiz;
  const questions = (quiz.questions ?? []) as StoredQuestion[];
  const documentIds =
    stringArray(quiz.documentIds).length > 0
      ? stringArray(quiz.documentIds)
      : stringArray([quiz.documentId]);

  return { quiz, questions, documentIds };
}

function normalizeKnowledge(
  question: StoredQuestion,
  fallbackDocumentIds: string[],
): QuestionKnowledgeMetadata {
  const source = question.knowledge ?? {};
  const sourceDocumentIds =
    stringArray(source.sourceDocumentIds).length > 0
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
      ? Timestamp.fromDate(
          parseDate(input.detailedExplanationRequestedAt, 'detailedExplanationRequestedAt'),
        )
      : undefined;

    return {
      questionIndex: input.questionIndex,
      questionText: question.question,
      ...answer,
      ...(input.timeSpentMs !== undefined
        ? { timeSpentMs: Math.max(0, input.timeSpentMs) }
        : {}),
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
  },
): Record<string, unknown> {
  return {
    userId,
    date,
    ...(knowledge.subjectId ? { subjectId: knowledge.subjectId } : {}),
    ...(knowledge.subjectName ? { subjectName: knowledge.subjectName } : {}),
    ...(knowledge.knowledgeDomainId ? { knowledgeDomainId: knowledge.knowledgeDomainId } : {}),
    ...(knowledge.knowledgeDomainName ? { knowledgeDomainName: knowledge.knowledgeDomainName } : {}),
    topicTags: knowledge.topicTags ?? [],
    answerCount: increment(increments.answerCount ?? 0),
    correctCount: increment(increments.correctCount ?? 0),
    incorrectCount: increment(increments.incorrectCount ?? 0),
    explanationRequestCount: increment(increments.explanationRequestCount ?? 0),
    updatedAt: serverTimestamp(),
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
  },
): Record<string, unknown> {
  return {
    userId,
    quizId,
    quizType,
    questionIndex: answer.questionIndex,
    questionText: answer.questionText,
    knowledge: answer.knowledge,
    answerCount: increment(increments.answerCount ?? 0),
    correctCount: increment(increments.correctCount ?? 0),
    incorrectCount: increment(increments.incorrectCount ?? 0),
    explanationRequestCount: increment(increments.explanationRequestCount ?? 0),
    updatedAt: serverTimestamp(),
  };
}

export async function recordQuizAttemptInFirestore(
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

  const attemptRef = doc(quizAttemptCollection(userId));
  const eventRef = doc(learningEventCollection(userId));
  const quizStatDocRef = quizStatRef(userId, statId(data.quizType, data.quizId));

  await runTransaction(db, async (transaction) => {
    const quizStatSnap = await transaction.get(quizStatDocRef);
    const existingStats = quizStatSnap.exists()
      ? (quizStatSnap.data() as Partial<QuizStatsSummary>)
      : {};
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
      expiresAt: computeExpiresAt(completedAt, 'learningRaw'),
    });

    transaction.set(eventRef, {
      id: eventRef.id,
      userId,
      eventType: 'quiz_attempt_completed',
      quizId: data.quizId,
      quizType: data.quizType,
      occurredAt: Timestamp.fromDate(completedAt),
      expiresAt: computeExpiresAt(completedAt, 'learningRaw'),
    });

    transaction.set(
      quizStatDocRef,
      {
        userId,
        quizId: data.quizId,
        quizType: data.quizType,
        directoryId: resolved.quiz.directoryId,
        documentIds: resolved.documentIds,
        totalQuestions,
        attemptCount: increment(1),
        totalScore: increment(score),
        totalPercentage: increment(percentage),
        totalDurationMs: increment(durationMs),
        bestScore,
        bestPercentage,
        latestScore: score,
        latestPercentage: percentage,
        incorrectAnswerCount: increment(incorrectAnswerCount),
        explanationRequestCount: increment(0),
        lastAttemptAt: Timestamp.fromDate(completedAt),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );

    for (const answer of answers) {
      const answerEventRef = doc(learningEventCollection(userId));
      const questionStatDocRef = questionStatRef(
        userId,
        statId(data.quizType, data.quizId, answer.questionIndex),
      );
      const knowledgeDocRef = knowledgeStatRef(
        userId,
        knowledgeStatId(date, answer.knowledge),
      );

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
        expiresAt: computeExpiresAt(completedAt, 'learningRaw'),
      });

      transaction.set(
        questionStatDocRef,
        questionStatPayload(userId, data.quizId, data.quizType, answer, {
          answerCount: 1,
          correctCount: answer.isCorrect ? 1 : 0,
          incorrectCount: answer.isCorrect ? 0 : 1,
        }),
        { merge: true },
      );

      transaction.set(
        knowledgeDocRef,
        knowledgeStatPayload(userId, date, answer.knowledge, {
          answerCount: 1,
          correctCount: answer.isCorrect ? 1 : 0,
          incorrectCount: answer.isCorrect ? 0 : 1,
        }),
        { merge: true },
      );
    }
  });

  return attemptRef.id;
}

export async function recordQuizExplanationRequestInFirestore(
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
  const eventRef = doc(learningEventCollection(userId));
  const quizStatDocRef = quizStatRef(userId, statId(data.quizType, data.quizId));
  const questionStatDocRef = questionStatRef(
    userId,
    statId(data.quizType, data.quizId, data.questionIndex),
  );
  const knowledgeDocRef = knowledgeStatRef(userId, knowledgeStatId(date, knowledge));

  const batch = writeBatch(db);
  batch.set(eventRef, {
    id: eventRef.id,
    userId,
    eventType: 'detailed_explanation_requested',
    quizId: data.quizId,
    quizType: data.quizType,
    questionIndex: data.questionIndex,
    knowledge,
    occurredAt: Timestamp.fromDate(requestedAt),
    expiresAt: computeExpiresAt(requestedAt, 'learningRaw'),
  });
  batch.set(
    quizStatDocRef,
    {
      userId,
      quizId: data.quizId,
      quizType: data.quizType,
      directoryId: resolved.quiz.directoryId,
      documentIds: resolved.documentIds,
      totalQuestions: resolved.questions.length,
      explanationRequestCount: increment(1),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
  batch.set(
    questionStatDocRef,
    questionStatPayload(
      userId,
      data.quizId,
      data.quizType,
      {
        questionIndex: data.questionIndex,
        questionText: question.question,
        selectedAnswer: null,
        correctAnswer: null,
        isCorrect: false,
        knowledge,
        detailedExplanationRequested: true,
      },
      { explanationRequestCount: 1 },
    ),
    { merge: true },
  );
  batch.set(
    knowledgeDocRef,
    knowledgeStatPayload(userId, date, knowledge, { explanationRequestCount: 1 }),
    { merge: true },
  );

  await batch.commit();
  return eventRef.id;
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

export async function getQuizStatsFromFirestore(
  userId: string,
  quizType: QuizTelemetryType,
  quizId: string,
): Promise<QuizStatsSummary | null> {
  const snap = await getDoc(quizStatRef(userId, statId(quizType, quizId)));
  if (!snap.exists()) {
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
