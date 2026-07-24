const DEFAULT_HINT_EXAMPLE = 'Look for the key relationship in the source material before answering.';

export function buildQuizHintFieldInstruction(example = DEFAULT_HINT_EXAMPLE): string {
  return `- \`hint\`: a short, helpful clue that nudges the learner without giving away the answer (e.g. "${example}")`;
}

export function buildQuizHintJsonRule(): string {
  return '- `hint` is required and must be a short, non-empty string (one sentence, max 20 words).';
}

export function buildQuizHintExampleLine(example = DEFAULT_HINT_EXAMPLE): string {
  return `"hint": "${example}"`;
}
