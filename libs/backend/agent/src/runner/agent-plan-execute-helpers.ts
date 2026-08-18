import { z } from 'zod';
import { JsonSanitizer } from '@study-forge/backend-llm/llm';
import type { AgentToolDefinition } from '../tools/create-agent-tools';
import type { AgentToolOutcome } from './agent-chat-fallback';

export const MAX_PLAN_STEPS = 8;

const CREATE_DOCUMENT_OBJECTIVE =
  /\b(?:create|make|write|add|draft)\s+(?:(?:a|an|the|new|some|\d+)\s+)*(?:docs?|documents?)\b|\bnew docs?\b/i;

const PROPOSE_FIRST_OBJECTIVE =
  /\b(?:suggest|propose)\b[\s\S]{0,80}\b(?:plan|validat)|\bbefore (?:you )?(?:start|creating|create)|\bfirst\b[\s\S]{0,80}\b(?:suggest|propose|validate)|(?:do not|don't)\s+(?:yet\s+)?create/i;

export const UNGROUNDED_CREATE_FALLBACK =
  'I did not create the document. The create_document tool never ran, so nothing was saved. Please try again.';

export const agentPlanOutputSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('plan'),
    steps: z.array(z.string().trim().min(1)).min(1).max(MAX_PLAN_STEPS),
  }),
  z.object({
    type: z.literal('response'),
    response: z.string().trim().min(1),
  }),
]);

export type AgentPlanOutput = z.output<typeof agentPlanOutputSchema>;

export interface AgentPlanExecutePastStep {
  step: string;
  result: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function formatEntityRef(value: unknown): string {
  if (!isRecord(value)) {
    return '';
  }
  const parts = [
    asString(value.id) ? `id=${asString(value.id)}` : undefined,
    (asString(value.title) ?? asString(value.name))
      ? `title=${asString(value.title) ?? asString(value.name)}`
      : undefined,
    asString(value.path) ? `path=${asString(value.path)}` : undefined,
  ].filter((part): part is string => Boolean(part));
  return parts.join(' ');
}

export function formatVerifiedToolResults(
  outcomes: AgentToolOutcome[],
): string {
  if (outcomes.length === 0) {
    return 'None. No tools ran in this step.';
  }

  return outcomes
    .map((outcome) => {
      if (!outcome.ok) {
        return `- ${outcome.name}: FAILED (${outcome.error ?? 'unknown error'})`;
      }

      if (Array.isArray(outcome.result)) {
        const items = outcome.result.slice(0, 40).map((item) => {
          const ref = formatEntityRef(item);
          return ref.length > 0 ? ref : String(item);
        });
        const more =
          outcome.result.length > items.length
            ? ` (+${outcome.result.length - items.length} more)`
            : '';
        return `- ${outcome.name}: OK, ${outcome.result.length} items: ${items.join('; ')}${more}`;
      }

      const ref = formatEntityRef(outcome.result);
      return `- ${outcome.name}: OK${ref ? ` ${ref}` : ''}`;
    })
    .join('\n');
}

export function composeExecutorStepResult(
  modelText: string,
  outcomes: AgentToolOutcome[],
): string {
  return [
    'TOOL RESULTS (source of truth; the only valid entity IDs from this step are listed here):',
    formatVerifiedToolResults(outcomes),
    'Executor notes (unverified; ignore create/update claims unless confirmed above):',
    modelText.trim() || '(none)',
  ].join('\n');
}

export function hasSuccessfulCreateDocument(
  outcomes: AgentToolOutcome[],
): boolean {
  return outcomes.some((outcome) => {
    if (!outcome.ok || outcome.name !== 'create_document') {
      return false;
    }
    return (
      isRecord(outcome.result) &&
      Boolean(
        asString(outcome.result.id) ?? asString(outcome.result.documentId),
      )
    );
  });
}

export function isProposeFirstObjective(objective: string): boolean {
  return PROPOSE_FIRST_OBJECTIVE.test(objective);
}

export function isCreateDocumentObjective(objective: string): boolean {
  return (
    CREATE_DOCUMENT_OBJECTIVE.test(objective) &&
    !isProposeFirstObjective(objective)
  );
}

export function shouldBlockUngroundedCreateResponse(input: {
  objective: string;
  outcomes: AgentToolOutcome[];
}): boolean {
  return (
    isCreateDocumentObjective(input.objective) &&
    !hasSuccessfulCreateDocument(input.outcomes)
  );
}

export function buildGroundedCreateReply(
  outcomes: AgentToolOutcome[],
): string | null {
  const created = outcomes.filter((outcome) => {
    if (
      !outcome.ok ||
      outcome.name !== 'create_document' ||
      !isRecord(outcome.result)
    ) {
      return false;
    }
    const result = outcome.result as Record<string, unknown>;
    return Boolean(asString(result.id) ?? asString(result.documentId));
  });

  if (created.length === 0) {
    return null;
  }

  return created
    .map((outcome) => {
      const result = outcome.result as Record<string, unknown>;
      const title = asString(result.title) ?? 'Untitled';
      const id = asString(result.id) ?? asString(result.documentId);
      return `Started generating document "${title}".\nID: ${id}`;
    })
    .join('\n\n');
}

export function formatToolCatalog(tools: AgentToolDefinition[]): string {
  return tools.map((tool) => `- ${tool.name}: ${tool.description}`).join('\n');
}

function formatPastSteps(pastSteps: AgentPlanExecutePastStep[]): string {
  if (pastSteps.length === 0) {
    return 'None yet.';
  }

  return pastSteps
    .map(
      (entry, index) =>
        `${index + 1}. Step: ${entry.step}\n   Result: ${entry.result}`,
    )
    .join('\n');
}

export function buildPlannerPrompt(input: {
  tools: AgentToolDefinition[];
  isReplan: boolean;
}): string {
  const mode = input.isReplan ? 'replanner' : 'planner';

  return [
    `You are the StudyForge workspace agent ${mode}.`,
    'Return ONLY valid JSON with no markdown fences.',
    'Use one of these shapes:',
    '{"type":"plan","steps":["step one","step two"]}',
    '{"type":"response","response":"final user-facing reply"}',
    'Rules:',
    '- Steps must be plain language, not tool JSON.',
    '- Each step should be achievable with the available tools in one focused pass.',
    '- Do not include steps that were already completed.',
    '- Prefer a direct response when no tools are needed.',
    '- Resolve follow-ups such as "that document", "regenerate", or "try again" from Recent conversation. Do not ask the user to restate an item the prior turn already named.',
    '- Never invent document, directory, or rule IDs.',
    '- Never claim a document was created unless TOOL RESULTS include create_document: OK with an id= value.',
    '- create_document queues documentFromPrompt. Tell the user generation is in progress; do not claim the HTML is already written.',
    '- If the user asked to create a document now and create_document did not succeed, return a plan step that calls create_document. Do not return type=response claiming it exists.',
    '- If the user asked to suggest, propose, or validate a study plan first, return type=response with the plan. Do not call create_document until they approve.',
    '- When listing a folder, only name items that appear in list_documents TOOL RESULTS. Do not add items from executor notes or earlier chat.',
    `- At most ${MAX_PLAN_STEPS} steps.`,
    'Available tools:',
    formatToolCatalog(input.tools),
  ].join('\n');
}

export function formatConversationHistory(
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
): string | undefined {
  if (history.length === 0) {
    return undefined;
  }

  return history.map((entry) => `${entry.role}: ${entry.content}`).join('\n\n');
}

export function buildPlannerUserMessage(input: {
  objective: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  pastSteps: AgentPlanExecutePastStep[];
  remainingPlan?: string[];
}): string {
  const sections: string[] = [];
  const conversation = formatConversationHistory(input.history ?? []);
  if (conversation) {
    sections.push(`Recent conversation:\n${conversation}`);
  }

  sections.push(`Objective:\n${input.objective}`);

  if (input.pastSteps.length > 0) {
    sections.push(`Completed steps:\n${formatPastSteps(input.pastSteps)}`);
  }

  if (input.remainingPlan && input.remainingPlan.length > 0) {
    sections.push(
      `Previous remaining plan (revise as needed):\n${input.remainingPlan
        .map((step, index) => `${index + 1}. ${step}`)
        .join('\n')}`,
    );
  }

  if (input.pastSteps.length > 0) {
    sections.push(
      'Decide whether to return the final user-facing response or an updated remaining plan.',
    );
  } else {
    sections.push(
      'Return either a multi-step plan or a direct response if tools are not needed.',
    );
  }

  return sections.join('\n\n');
}

export function buildStepExecutionMessage(input: {
  objective: string;
  step: string;
  pastSteps: AgentPlanExecutePastStep[];
}): string {
  const prior =
    input.pastSteps.length > 0
      ? `\n\nCompleted earlier steps:\n${formatPastSteps(input.pastSteps)}`
      : '';

  return [
    `Overall objective:\n${input.objective}`,
    prior,
    `\nCurrent plan step (complete only this step):\n${input.step}`,
    'Use tools as needed for this step only.',
    'Calling a tool is the only way to create or update resources. A written summary does not create a document.',
    'If this step is to create a document, you MUST call create_document with a generation prompt. Never invent an id. Do not write the HTML yourself.',
  ].join('');
}

export function parseAgentPlanOutput(raw: string): AgentPlanOutput | null {
  const cleaned = JsonSanitizer.initialCleanup(raw);
  const parsedJson: unknown = (() => {
    try {
      return JSON.parse(cleaned);
    } catch {
      try {
        return JsonSanitizer.tryFallbackParsing(cleaned);
      } catch {
        return null;
      }
    }
  })();

  const parsed = agentPlanOutputSchema.safeParse(parsedJson);
  if (!parsed.success) {
    return null;
  }

  return parsed.data;
}
