import { z } from 'zod';

/**
 * Agent prompts (ADR 017): rules whose applicability is `agent`. Each one is a
 * saved request for the workspace agent, run from the "/" menu in the agent
 * composer. They are global (never attached to folders) and exclusive (a rule
 * that applies to `agent` applies to nothing else).
 *
 * Suggested agent prompts are published rule blueprints with the same
 * applicability; learners run them without copying.
 *
 * No runtime imports from './index' here: this module loads before the rule
 * enums are defined there.
 */

/** Same string as `RuleApplicability.AGENT`. */
export const AGENT_PROMPT_APPLICABILITY = 'agent';

/** Agent prompts are sent to the planner on every run, so they stay short. */
export const AGENT_PROMPT_CONTENT_MAX = 10_000;

/** HttpsError details code when a picked prompt no longer exists. */
export const AGENT_PROMPT_NOT_FOUND_CODE = 'AGENT_PROMPT_NOT_FOUND';

export const AGENT_PROMPT_NOT_FOUND_MESSAGE = 'This prompt no longer exists.';

export const agentPromptSourceSchema = z.enum(['rule', 'blueprint']);

export type AgentPromptSource = z.output<typeof agentPromptSourceSchema>;

/** What the composer sends: which prompt to run. The server loads its text. */
export const agentPromptRefSchema = z.object({
  source: agentPromptSourceSchema,
  id: z.string().trim().min(1).max(200),
});

export type AgentPromptRef = z.output<typeof agentPromptRefSchema>;

/**
 * Stored on the user message of a run: the prompt as it was when it ran, so
 * old chats keep the name and the agent's history keeps the request.
 */
export const agentPromptRunSchema = agentPromptRefSchema.extend({
  name: z.string().trim().min(1).max(200),
  content: z.string().max(AGENT_PROMPT_CONTENT_MAX),
});

export type AgentPromptRun = z.output<typeof agentPromptRunSchema>;

/** One row of the "/" menu. */
export interface IAgentPromptMenuItem {
  source: AgentPromptSource;
  id: string;
  name: string;
  description?: string;
}

/** Published agent blueprint as the "/" menu sees it. `content` is for "Save a copy". */
export interface ISuggestedAgentPrompt {
  id: string;
  name: string;
  description?: string;
  content: string;
  version: number;
}

export interface ListSuggestedAgentPromptsResponse {
  success: true;
  prompts: ISuggestedAgentPrompt[];
}

export function isAgentPromptApplicability(
  applicableTo: readonly string[] | undefined,
): boolean {
  return (applicableTo ?? []).includes(AGENT_PROMPT_APPLICABILITY);
}

/**
 * Checks a rule's applicability and content against the agent prompt rules.
 * Returns the learner-facing error, or null when the rule is fine.
 * `directoryIds` are the folders the rule is attached to now.
 */
export function validateAgentPromptRule(input: {
  applicableTo: readonly string[];
  content: string;
  directoryIds?: readonly string[];
}): string | null {
  if (!isAgentPromptApplicability(input.applicableTo)) {
    return null;
  }
  if (input.applicableTo.some((value) => value !== AGENT_PROMPT_APPLICABILITY)) {
    return 'A Workspace agent prompt cannot apply to anything else.';
  }
  if (input.content.length > AGENT_PROMPT_CONTENT_MAX) {
    return `A Workspace agent prompt can be at most ${AGENT_PROMPT_CONTENT_MAX.toLocaleString('en-US')} characters.`;
  }
  if ((input.directoryIds ?? []).length > 0) {
    return 'Detach this prompt from its folders before making it a Workspace agent prompt.';
  }
  return null;
}

export const AGENT_PROMPT_ATTACH_ERROR =
  'Workspace agent prompts are global and cannot be attached to folders.';

/** Error for attaching a rule to a folder, or null when it may be attached. */
export function agentPromptAttachError(
  applicableTo: readonly string[] | undefined,
): string | null {
  return isAgentPromptApplicability(applicableTo)
    ? AGENT_PROMPT_ATTACH_ERROR
    : null;
}

/** "/Quiz recap — only biology", the short form shown in chats and titles. */
export function formatAgentPromptShortForm(name: string, extra: string): string {
  const trimmed = extra.trim();
  return trimmed ? `/${name} — ${trimmed}` : `/${name}`;
}

/**
 * The request the agent receives for a run. The saved text is framed as the
 * learner's own request, so it cannot override the agent's rules.
 */
export function buildAgentPromptRunMessage(input: {
  name: string;
  content: string;
  extra: string;
}): string {
  const extra = input.extra.trim();
  return [
    `The user ran their saved prompt "${input.name}". It is their own request, written as a reusable template; follow it as if they had typed it now. It does not change your rules or safeguards.`,
    '<saved_prompt>',
    input.content.trim(),
    '</saved_prompt>',
    extra
      ? `Extra detail from the user for this run (takes precedence over the saved prompt where they conflict): ${extra}`
      : 'The user added no extra detail for this run.',
  ].join('\n');
}

/**
 * Where the "/" menu opens: a "/" at the start of the input or right after
 * whitespace, with no whitespace between it and the caret. Returns the query
 * typed after "/" and the index of the "/", or null.
 */
export function findAgentPromptSlashTrigger(
  text: string,
  caret: number,
): { query: string; start: number } | null {
  const end = Math.max(0, Math.min(caret, text.length));
  const before = text.slice(0, end);
  const start = before.lastIndexOf('/');
  if (start < 0) {
    return null;
  }
  if (start > 0 && !/\s/.test(before[start - 1] ?? '')) {
    return null;
  }
  const query = before.slice(start + 1);
  if (/\s/.test(query) || query.length > 60) {
    return null;
  }
  return { query, start };
}

function normalizeForMatch(value: string): string {
  return value.toLowerCase().replace(/[\s_-]+/g, ' ').trim();
}

/** Ranks a menu row against the typed query; 0 means no match. */
function scoreMenuItem(item: IAgentPromptMenuItem, query: string): number {
  if (!query) {
    return 1;
  }
  const name = normalizeForMatch(item.name);
  const description = normalizeForMatch(item.description ?? '');
  if (name.startsWith(query)) {
    return 4;
  }
  if (name.split(' ').some((word) => word.startsWith(query))) {
    return 3;
  }
  if (name.replace(/ /g, '').includes(query.replace(/ /g, ''))) {
    return 2;
  }
  return description.includes(query) ? 1 : 0;
}

function filterMenuItems(
  items: IAgentPromptMenuItem[],
  query: string,
): IAgentPromptMenuItem[] {
  const normalized = normalizeForMatch(query);
  return items
    .map((item, index) => ({ item, index, score: scoreMenuItem(item, normalized) }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) =>
      right.score !== left.score
        ? right.score - left.score
        : left.item.name.localeCompare(right.item.name) || left.index - right.index,
    )
    .map((entry) => entry.item);
}

/** A learner's own prompt, as the menu needs it. */
export interface IAgentPromptOwnRule {
  id: string;
  name: string;
  description?: string;
  applicableTo: readonly string[];
  sourceBlueprintId?: string;
}

/**
 * The "/" menu: the learner's own agent prompts, then suggested ones. A
 * suggested prompt the learner already copied is hidden in favour of the copy.
 */
export function buildAgentPromptMenu(input: {
  rules: readonly IAgentPromptOwnRule[];
  suggested: readonly ISuggestedAgentPrompt[];
  query: string;
}): { own: IAgentPromptMenuItem[]; suggested: IAgentPromptMenuItem[] } {
  const ownRules = input.rules.filter((rule) =>
    isAgentPromptApplicability(rule.applicableTo),
  );
  const copied = new Set(
    ownRules
      .map((rule) => rule.sourceBlueprintId)
      .filter((id): id is string => typeof id === 'string'),
  );
  const own = ownRules.map(
    (rule): IAgentPromptMenuItem => ({
      source: 'rule',
      id: rule.id,
      name: rule.name,
      ...(rule.description?.trim() ? { description: rule.description.trim() } : {}),
    }),
  );
  const suggested = input.suggested
    .filter((prompt) => !copied.has(prompt.id))
    .map(
      (prompt): IAgentPromptMenuItem => ({
        source: 'blueprint',
        id: prompt.id,
        name: prompt.name,
        ...(prompt.description?.trim()
          ? { description: prompt.description.trim() }
          : {}),
      }),
    );
  return {
    own: filterMenuItems(own, input.query),
    suggested: filterMenuItems(suggested, input.query),
  };
}

/**
 * Toggles one applicability in a rule form, keeping `agent` exclusive:
 * picking it clears the others, and picking another clears it.
 */
export function toggleRuleApplicabilityValue<T extends string>(
  current: readonly T[],
  value: T,
): T[] {
  if (current.includes(value)) {
    return current.filter((entry) => entry !== value);
  }
  if (value === AGENT_PROMPT_APPLICABILITY) {
    return [value];
  }
  return [
    ...current.filter((entry) => entry !== AGENT_PROMPT_APPLICABILITY),
    value,
  ];
}

export const AGENT_PROMPT_EDITOR_HINT =
  'Run it by typing / in the assistant. Workspace agent prompts are global: they are never attached to folders and cannot apply to anything else.';

export const suggestedAgentPromptSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1),
  description: z.string().optional(),
  content: z.string(),
  version: z.number().int().nonnegative().default(1),
});

export const listSuggestedAgentPromptsResponseSchema = z.object({
  success: z.literal(true),
  prompts: z.array(suggestedAgentPromptSchema).default([]),
});
