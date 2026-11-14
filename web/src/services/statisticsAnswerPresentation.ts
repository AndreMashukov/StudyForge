import type {
  QuizAnswerValue,
  QuizTelemetryType,
  IStatisticsMatchPair,
} from '@shared-types';

interface IMatchOption {
  id: string;
  text: string;
}

export interface IStatisticsQuestionMetadata {
  question?: string;
  hint?: string;
  explanation?: string;
  options: string[];
  diagrams: string[];
  diagramLabels: string[];
  prompts: IMatchOption[];
  matchOptions: IMatchOption[];
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item: unknown) => (typeof item === 'string' ? item : ''))
    : [];
}

function matchOptions(value: unknown): IMatchOption[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item: unknown) => {
    if (
      !item ||
      typeof item !== 'object' ||
      !('id' in item) ||
      !('text' in item) ||
      typeof item.id !== 'string' ||
      typeof item.text !== 'string'
    )
      return [];
    return [{ id: item.id, text: item.text }];
  });
}

export function statisticsQuestionMetadata(
  value: unknown,
): IStatisticsQuestionMetadata {
  const empty = {
    options: [],
    diagrams: [],
    diagramLabels: [],
    prompts: [],
    matchOptions: [],
  };
  if (!value || typeof value !== 'object') return empty;
  return {
    ...('question' in value && typeof value.question === 'string'
      ? { question: value.question }
      : {}),
    ...('hint' in value && typeof value.hint === 'string'
      ? { hint: value.hint }
      : {}),
    ...('explanation' in value && typeof value.explanation === 'string'
      ? { explanation: value.explanation }
      : {}),
    // Preserve indexes even if an option is malformed; dropping it would relabel later answers.
    options:
      'options' in value && Array.isArray(value.options)
        ? value.options.map((option: unknown) =>
            typeof option === 'string' ? option : '',
          )
        : [],
    diagrams: 'diagrams' in value ? strings(value.diagrams) : [],
    diagramLabels: 'diagramLabels' in value ? strings(value.diagramLabels) : [],
    prompts:
      'prompts' in value && Array.isArray(value.prompts)
        ? value.prompts.map(
            (item: unknown) =>
              matchOptions([item])[0] ?? {
                id: '',
                text: 'Prompt text unavailable',
              },
          )
        : [],
    matchOptions: 'options' in value ? matchOptions(value.options) : [],
  };
}

export function statisticsAnswerLabel(
  value: QuizAnswerValue,
  question: IStatisticsQuestionMetadata | undefined,
  quizType: QuizTelemetryType,
): string {
  if (value === null || value === undefined) return 'No answer';
  if (quizType === 'matchQuiz') {
    if (!Array.isArray(value) || !question?.prompts.length)
      return 'Answer text unavailable';
    return question.prompts
      .map(
        (prompt, index) =>
          `${prompt.text} → ${matchText(value[index], question)}`,
      )
      .join('; ');
  }
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'number') {
    if (!Number.isInteger(value) || value < 0) return 'Answer text unavailable';
    const text =
      quizType === 'diagramQuiz'
        ? question?.diagramLabels[value]
        : question?.options[value];
    return text?.trim() ? text : 'Answer text unavailable';
  }
  return String(value);
}

function matchText(id: unknown, question: IStatisticsQuestionMetadata): string {
  if (id === null || id === undefined || id === '') return 'No answer';
  return (
    question.matchOptions.find((option) => option.id === id)?.text ||
    'Answer text unavailable'
  );
}

export function statisticsMatchPairs(
  selected: QuizAnswerValue,
  correct: QuizAnswerValue,
  question: IStatisticsQuestionMetadata | undefined,
): IStatisticsMatchPair[] {
  if (!question?.prompts.length) return [];
  const selectedIds = Array.isArray(selected) ? selected : [];
  const correctIds = Array.isArray(correct) ? correct : [];
  return question.prompts.map((prompt, index) => ({
    prompt: prompt.text,
    selectedText: matchText(selectedIds[index], question),
    correctText: matchText(correctIds[index], question),
    isCorrect: Boolean(
      selectedIds[index] &&
        correctIds[index] &&
        selectedIds[index] === correctIds[index],
    ),
  }));
}
