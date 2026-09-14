export function quizFailureGroupKey(
  quizType: string,
  quizId: string,
  questionIndex: number,
): string {
  return `${quizType}:${quizId}:${questionIndex}`;
}

export function flashcardFailureGroupKey(
  flashcardSetId: string,
  cardId: string,
): string {
  return `flashcardSet:${flashcardSetId}:${cardId}`;
}

export function encodeStatisticsHiddenFailureId(groupKey: string): string {
  return groupKey
    .split(':')
    .map((part) => encodeURIComponent(part))
    .join('__');
}

export function isAnsweredQuizInput(
  selectedAnswer: string | string[] | number | number[] | null | undefined,
): boolean {
  if (selectedAnswer === null || selectedAnswer === undefined) {
    return false;
  }
  if (Array.isArray(selectedAnswer)) {
    return selectedAnswer.length > 0;
  }
  if (typeof selectedAnswer === 'number') {
    return selectedAnswer >= 0;
  }
  return String(selectedAnswer).trim().length > 0;
}
