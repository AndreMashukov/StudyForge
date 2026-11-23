import {
  AGENT_QUESTION_LIMITS,
  agentQuestionSchema,
  type AgentQuestion,
  type AgentQuestionOption,
} from './agent';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function clip(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim().replace(/\s+/g, ' ');
  if (trimmed.length === 0) return undefined;
  return trimmed.length > max
    ? `${trimmed.slice(0, max - 1).trimEnd()}…`
    : trimmed;
}

function normalizeOption(raw: unknown): AgentQuestionOption | null {
  if (typeof raw === 'string') {
    const label = clip(raw, AGENT_QUESTION_LIMITS.maxOptionLabelChars);
    return label ? { label } : null;
  }
  if (!isRecord(raw)) return null;
  const label = clip(raw.label, AGENT_QUESTION_LIMITS.maxOptionLabelChars);
  if (!label) return null;
  const description = clip(
    raw.description,
    AGENT_QUESTION_LIMITS.maxOptionDescriptionChars,
  );
  return {
    label,
    ...(description ? { description } : {}),
    ...(raw.recommended === true ? { recommended: true } : {}),
  };
}

function normalizeOptions(raw: unknown): AgentQuestionOption[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const options: AgentQuestionOption[] = [];
  for (const entry of raw) {
    const option = normalizeOption(entry);
    if (!option) continue;
    const key = option.label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    options.push(option);
    if (options.length === AGENT_QUESTION_LIMITS.maxOptions) break;
  }

  // At most one recommended option: keep the first one the model marked.
  let recommendedSeen = false;
  return options.map((option) => {
    if (!option.recommended) return option;
    if (recommendedSeen) {
      return {
        label: option.label,
        ...(option.description ? { description: option.description } : {}),
      };
    }
    recommendedSeen = true;
    return option;
  });
}

/**
 * Turns model output into valid clarifying questions. Malformed entries are
 * dropped rather than failing the turn; ids are filled in and made unique.
 */
export function normalizeAgentQuestions(raw: unknown): AgentQuestion[] {
  if (!Array.isArray(raw)) return [];
  const questions: AgentQuestion[] = [];
  const usedIds = new Set<string>();

  for (const entry of raw) {
    if (questions.length === AGENT_QUESTION_LIMITS.maxQuestions) break;
    if (!isRecord(entry)) continue;

    const question = clip(
      entry.question,
      AGENT_QUESTION_LIMITS.maxQuestionChars,
    );
    const options = normalizeOptions(entry.options);
    if (!question || options.length < AGENT_QUESTION_LIMITS.minOptions)
      continue;

    let id = clip(entry.id, 40) ?? `q${questions.length + 1}`;
    while (usedIds.has(id)) id = `${id}-${questions.length + 1}`;
    usedIds.add(id);

    const header = clip(entry.header, AGENT_QUESTION_LIMITS.maxHeaderChars);
    const parsed = agentQuestionSchema.safeParse({
      id,
      ...(header ? { header } : {}),
      question,
      options,
      allowOther: entry.allowOther !== false,
    });
    if (parsed.success) questions.push(parsed.data);
  }

  return questions;
}

export interface IAgentQuestionAnswer {
  question: AgentQuestion;
  /** The chosen option label or the user's own text; null when skipped. */
  answer: string | null;
}

/** Sent for a skipped question, so the agent knows to use its own judgement. */
export const AGENT_QUESTION_SKIPPED_ANSWER =
  'No preference — use your judgement';

/**
 * The user message that answers a set of questions. It repeats each question
 * so the answer stays readable in the chat and unambiguous for the agent.
 */
export function formatAgentQuestionAnswers(
  answers: ReadonlyArray<IAgentQuestionAnswer>,
): string {
  return answers
    .map(({ question, answer }) => {
      const text = answer?.trim() || AGENT_QUESTION_SKIPPED_ANSWER;
      return `${question.question}\n→ ${text}`;
    })
    .join('\n\n');
}

/** The recommended option, if the agent marked one. */
export function recommendedAgentQuestionOption(
  question: AgentQuestion,
): AgentQuestionOption | undefined {
  return question.options.find((option) => option.recommended === true);
}
