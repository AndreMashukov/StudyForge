import {
  ArtifactType,
  QuizTelemetryType,
  StatisticsDateRangeRequest,
  StatisticsQuizTypeFilter,
  StatisticsTimeRangeKey,
} from '@shared-types';

export function isQuizTelemetryType(value: string | undefined): value is QuizTelemetryType {
  return value === 'quiz' || value === 'diagramQuiz' || value === 'sequenceQuiz';
}

export const TIME_RANGE_OPTIONS: Array<{ value: StatisticsTimeRangeKey; label: string }> = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
  { value: 'all', label: 'All time' },
];

export const QUIZ_TYPE_OPTIONS: Array<{ value: StatisticsQuizTypeFilter; label: string }> = [
  { value: 'all', label: 'All quizzes' },
  { value: 'quiz', label: 'Quiz' },
  { value: 'diagramQuiz', label: 'Diagram' },
  { value: 'sequenceQuiz', label: 'Sequence' },
];

const QUIZ_TYPE_LABELS: Record<QuizTelemetryType, string> = {
  quiz: 'Quiz',
  diagramQuiz: 'Diagram quiz',
  sequenceQuiz: 'Sequence quiz',
};

const ARTIFACT_TYPE_LABELS: Record<ArtifactType, string> = {
  document: 'Documents',
  quiz: 'Quizzes',
  flashcardSet: 'Flashcards',
  slideDeck: 'Slide decks',
  diagramQuiz: 'Diagram quizzes',
  sequenceQuiz: 'Sequence quizzes',
  subjectWorld: 'Subject worlds',
};

function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getStatisticsDateRange(
  range: StatisticsTimeRangeKey,
  quizType: StatisticsQuizTypeFilter
): StatisticsDateRangeRequest {
  if (range === 'all') {
    return { quizType };
  }

  const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - (days - 1));

  return {
    startDate: toLocalDateString(start),
    endDate: toLocalDateString(now),
    quizType,
  };
}

export function formatInteger(value: number): string {
  return new Intl.NumberFormat().format(value);
}

export function formatPercentage(value: number): string {
  return `${Math.round(value)}%`;
}

export function formatSeconds(totalSeconds: number): string {
  if (totalSeconds < 60) return `${Math.round(totalSeconds)}s`;
  const minutes = Math.floor(totalSeconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

export function formatDurationMs(totalMs: number): string {
  return formatSeconds(Math.round(totalMs / 1000));
}

export function formatDateTime(value: string | undefined): string {
  if (!value) return 'No activity yet';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

export function quizTypeLabel(value: QuizTelemetryType): string {
  return QUIZ_TYPE_LABELS[value];
}

export function artifactTypeLabel(value: ArtifactType): string {
  return ARTIFACT_TYPE_LABELS[value];
}

export function detailQuizPath(quizType: QuizTelemetryType, quizId: string): string {
  return `/statistics/quizzes/${quizType}/${quizId}`;
}

export function knowledgePath(subjectKey: string, knowledgeDomainKey: string): string {
  return `/statistics/knowledge/${encodeURIComponent(subjectKey)}/${encodeURIComponent(knowledgeDomainKey)}`;
}