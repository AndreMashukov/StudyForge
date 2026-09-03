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
  MatchQuiz,
  MatchQuizQuestion,
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
  matchQuizRef,
  questionStatRef,
  quizAttemptCollection,
  quizRef,
  quizStatRef,
  sequenceQuizRef,
} from './firestorePaths';

type StoredQuiz = Quiz | DiagramQuiz | SequenceQuiz | MatchQuiz;
type StoredQuestion =
  | QuizQuestion
  | DiagramQuizQuestion
  | SequenceQuizQuestion
  | MatchQuizQuestion;

interface IResolvedQuiz {
  quiz: StoredQuiz;
  questions: StoredQuestion[];
  documentIds: string[];
}

function statId(...parts: Array<string | number | undefined>): string {
  return parts
    .map((part) =>
      encodeURIComponent(
        String(part ?? 'unclassified').trim() || 'unclassified',
      ),
    )
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
    ? value.filter(
        (item): item is string =>
          typeof item === 'string' && item.trim().length > 0,
      )
    : [];
}

function isSequenceQuestion(
  question: StoredQuestion,
): question is SequenceQuizQuestion {
  return 'items' in question;
}

function isMatchQuestion(
  question: StoredQuestion,
): question is MatchQuizQuestion {
  return 'prompts' in question && 'options' in question;
}

function isStoredQuestion(value: unknown): value is StoredQuestion {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  if (
    'prompts' in value &&
    'options' in value &&
    Array.isArray(value.prompts) &&
    Array.isArray(value.options)
  ) {
    return true;
  }
  if (
    'items' in value &&
    Array.isArray(value.items) &&
    'question' in value &&
    typeof value.question === 'string'
  ) {
    return true;
  }
  return 'question' in value && typeof value.question === 'string';
}

function quizDocRef(
  userId: string,
  quizType: QuizTelemetryType,
  quizId: string,
) {
  switch (quizType) {
    case 'quiz':
      return quizRef(userId, quizId);
    case 'diagramQuiz':
      return diagramQuizRef(userId, quizId);
    case 'sequenceQuiz':
      return sequenceQuizRef(userId, quizId);
    case 'matchQuiz':
      return matchQuizRef(userId, quizId);
    default: {
      const _exhaustive: never = quizType;
      throw new Error(`Unsupported quiz type: ${String(_exhaustive)}`);
    }
  }
}

function questionTextFor(question: StoredQuestion): string {
  if (isMatchQuestion(question)) {
    return question.prompts.map((prompt) => prompt.text).join(' | ');
  }
  return question.question;
}

function parseStoredQuiz(id: string, data: unknown): StoredQuiz | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return null;
  }
  if (!('questions' in data) || !Array.isArray(data.questions)) {
    return null;
  }
  if (!data.questions.every(isStoredQuestion)) {
    return null;
  }
  return { id, ...data, questions: data.questions } as StoredQuiz;
}

async function resolveQuiz(
  userId: string,
  quizType: QuizTelemetryType,
  quizId: string,
): Promise<IResolvedQuiz> {
  const snap = await getDoc(quizDocRef(userId, quizType, quizId));
  if (!snap.exists()) {
    throw new Error('Quiz not found');
  }

  const quiz = parseStoredQuiz(snap.id, snap.data());
  if (!quiz) {
    throw new Error('Quiz not found');
  }
  const documentIds =
    stringArray(quiz.documentIds).length > 0
      ? stringArray(quiz.documentIds)
      : stringArray([quiz.documentId]);

  return { quiz, questions: quiz.questions, documentIds };
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
    ...(source.knowledgeDomainId
      ? { knowledgeDomainId: source.knowledgeDomainId }
      : {}),
    ...(source.knowledgeDomainName
      ? { knowledgeDomainName: source.knowledgeDomainName }
      : {}),
    topicTags: stringArray(source.topicTags),
    sourceDocumentIds,
  };
}

function selectedNumber(value: QuizAnswerValue): number | null {
  return typeof value === 'number' && Number.isInteger(value) ? value : null;
}

function arraysEqual(left: string[], right: string[]): boolean {
  return (
    left.length === right.length &&
    left.every((item, index) => item === right[index])
  );
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

  if (isMatchQuestion(question)) {
    const selectedAnswer = stringArray(input.selectedAnswer);
    const correctAnswer = question.prompts.map((prompt) => {
      const option = question.options.find(
        (candidate) => candidate.correctPromptId === prompt.id,
      );
      return option ? option.id : '';
    });
    return {
      selectedAnswer,
      correctAnswer,
      isCorrect: arraysEqual(selectedAnswer, correctAnswer),
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
          parseDate(
            input.detailedExplanationRequestedAt,
            'detailedExplanationRequestedAt',
          ),
        )
      : undefined;

    return {
      questionIndex: input.questionIndex,
      questionText: questionTextFor(question),
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
    ...(knowledge.knowledgeDomainId
      ? { knowledgeDomainId: knowledge.knowledgeDomainId }
      : {}),
    ...(knowledge.knowledgeDomainName
      ? { knowledgeDomainName: knowledge.knowledgeDomainName }
      : {}),
    topicTags: knowledge.topicTags ?? [],
    answerCount: increment(increments.answerCount ?? 0),
    correctCount: increment(increments.correctCount ?? 0),
    incorrectCount: increment(increments.incorrectCount ?? 0),
    explanationRequestCount: increment(increments.explanationRequestCount ?? 0),
    updatedAt: serverTimestamp(),
  };
}

function knowledgeStatId(
  date: string,
  knowledge: QuestionKnowledgeMetadata,
): string {
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
  const percentage =
    totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0;
  const incorrectAnswerCount = answers.filter(
    (answer) => !answer.isCorrect,
  ).length;
  const durationMs = Math.max(0, data.durationMs || 0);

  const attemptRef = doc(quizAttemptCollection(userId));
  const eventRef = doc(learningEventCollection(userId));
  const quizStatDocRef = quizStatRef(
    userId,
    statId(data.quizType, data.quizId),
  );

  await runTransaction(db, async (transaction) => {
    const quizStatSnap = await transaction.get(quizStatDocRef);
    const existingBestScore = quizStatSnap.exists()
      ? Number(quizStatSnap.data().bestScore ?? 0)
      : 0;
    const existingBestPercentage = quizStatSnap.exists()
      ? Number(quizStatSnap.data().bestPercentage ?? 0)
      : 0;
    const bestScore = Math.max(existingBestScore, score);
    const bestPercentage = Math.max(existingBestPercentage, percentage);

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

    const knowledgeIncrements = new Map<
      string,
      {
        knowledge: QuestionKnowledgeMetadata;
        answerCount: number;
        correctCount: number;
        incorrectCount: number;
      }
    >();

    for (const answer of answers) {
      const answerEventRef = doc(learningEventCollection(userId));
      const questionStatDocRef = questionStatRef(
        userId,
        statId(data.quizType, data.quizId, answer.questionIndex),
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

      const knowledgeKey = knowledgeStatId(date, answer.knowledge);
      const existing = knowledgeIncrements.get(knowledgeKey);
      if (existing) {
        existing.answerCount += 1;
        existing.correctCount += answer.isCorrect ? 1 : 0;
        existing.incorrectCount += answer.isCorrect ? 0 : 1;
      } else {
        knowledgeIncrements.set(knowledgeKey, {
          knowledge: answer.knowledge,
          answerCount: 1,
          correctCount: answer.isCorrect ? 1 : 0,
          incorrectCount: answer.isCorrect ? 0 : 1,
        });
      }
    }

    for (const [knowledgeKey, incrementSet] of knowledgeIncrements) {
      transaction.set(
        knowledgeStatRef(userId, knowledgeKey),
        knowledgeStatPayload(userId, date, incrementSet.knowledge, {
          answerCount: incrementSet.answerCount,
          correctCount: incrementSet.correctCount,
          incorrectCount: incrementSet.incorrectCount,
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
  const quizStatDocRef = quizStatRef(
    userId,
    statId(data.quizType, data.quizId),
  );
  const questionStatDocRef = questionStatRef(
    userId,
    statId(data.quizType, data.quizId, data.questionIndex),
  );
  const knowledgeDocRef = knowledgeStatRef(
    userId,
    knowledgeStatId(date, knowledge),
  );

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
        questionText: questionTextFor(question),
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
    knowledgeStatPayload(userId, date, knowledge, {
      explanationRequestCount: 1,
    }),
    { merge: true },
  );

  await batch.commit();
  return eventRef.id;
}

function toStatDate(value: unknown, fallback: Date): Date {
  if (value instanceof Timestamp) {
    return value.toDate();
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return fallback;
}

function readStatNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export async function getQuizStatsFromFirestore(
  userId: string,
  quizType: QuizTelemetryType,
  quizId: string,
): Promise<QuizStatsSummary | null> {
  const snap = await getDoc(quizStatRef(userId, statId(quizType, quizId)));
  if (!snap.exists()) {
    return null;
  }

  const data = snap.data();
  const now = new Date();
  return {
    id: snap.id,
    userId,
    quizId,
    quizType,
    directoryId: typeof data.directoryId === 'string' ? data.directoryId : '',
    documentIds: stringArray(data.documentIds),
    totalQuestions: readStatNumber(data.totalQuestions),
    attemptCount: readStatNumber(data.attemptCount),
    totalScore: readStatNumber(data.totalScore),
    totalPercentage: readStatNumber(data.totalPercentage),
    totalDurationMs: readStatNumber(data.totalDurationMs),
    bestScore: readStatNumber(data.bestScore),
    bestPercentage: readStatNumber(data.bestPercentage),
    latestScore: readStatNumber(data.latestScore),
    latestPercentage: readStatNumber(data.latestPercentage),
    incorrectAnswerCount: readStatNumber(data.incorrectAnswerCount),
    explanationRequestCount: readStatNumber(data.explanationRequestCount),
    lastAttemptAt: data.lastAttemptAt
      ? toStatDate(data.lastAttemptAt, now)
      : undefined,
    updatedAt: toStatDate(data.updatedAt, now),
  };
}
