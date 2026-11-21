/**
 * Match quiz grading.
 *
 * Several prompts can share the same correct answer text (for example three
 * rows that all match "LangGraph"). Each of those rows gets its own option
 * chip, and the chips look identical to the learner, so grading compares the
 * chip *text* rather than the option id: any chip whose text matches the
 * row's correct option counts as correct.
 */

interface IMatchGradingOption {
  id: string;
  text: string;
  /** ID of the prompt this option matches; null for distractors. */
  correctPromptId: string | null;
}

interface IMatchGradingQuestion {
  prompts: ReadonlyArray<{ id: string }>;
  options: ReadonlyArray<IMatchGradingOption>;
}

/** Case- and whitespace-insensitive key used to compare option chips. */
export function normalizeMatchOptionText(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** The option generated as the answer for `promptId`, if any. */
export function findCorrectMatchOption<TOption extends IMatchGradingOption>(
  options: ReadonlyArray<TOption>,
  promptId: string,
): TOption | undefined {
  return options.find((option) => option.correctPromptId === promptId);
}

/** True when two option chips are indistinguishable to the learner. */
export function isSameMatchOptionText(
  a: Pick<IMatchGradingOption, 'text'> | undefined,
  b: Pick<IMatchGradingOption, 'text'> | undefined,
): boolean {
  if (!a || !b) return false;
  return normalizeMatchOptionText(a.text) === normalizeMatchOptionText(b.text);
}

/** Whether placing `optionId` on `promptId` is correct. */
export function isMatchPlacementCorrect(
  question: Pick<IMatchGradingQuestion, 'options'>,
  promptId: string,
  optionId: string | null | undefined,
): boolean {
  if (!optionId) return false;
  const correct = findCorrectMatchOption(question.options, promptId);
  if (!correct) return false;
  if (correct.id === optionId) return true;
  const placed = question.options.find((option) => option.id === optionId);
  return isSameMatchOptionText(placed, correct);
}

/** Whether every prompt row holds a correct chip (ids in prompt-row order). */
export function isMatchAnswerCorrect(
  question: IMatchGradingQuestion,
  placedOptionIds: ReadonlyArray<string>,
): boolean {
  if (question.prompts.length === 0) return false;
  if (placedOptionIds.length !== question.prompts.length) return false;
  return question.prompts.every((prompt, index) =>
    isMatchPlacementCorrect(question, prompt.id, placedOptionIds[index]),
  );
}
