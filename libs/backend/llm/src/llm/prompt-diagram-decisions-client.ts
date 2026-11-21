import { z } from 'zod';
import {
  PROMPT_DIAGRAM_COUNT_MAX,
  PROMPT_DIAGRAM_COUNT_MIN,
} from '@shared-types';
import { LlmGenerationRouteResolver } from './llm-generation-route-resolver';

/**
 * Prompt diagram check: asks a decision model whether Mermaid diagrams fit an
 * AI Prompt and how many to allow. The model comes from the
 * `promptDiagramDecision` generation route, so admins choose it per LLM setup.
 * Decision models are served by the OpenRouter Decisions API, not chat completions.
 */

export const DIAGRAM_SUITABILITY_THRESHOLD = 0.6;

const DECISIONS_PATH = '/api/alpha/decisions';
const DEFAULT_OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

const DIAGRAM_COUNT_CRITERIA = [
  'One diagram. The topic has a single flow, structure, or relationship.',
  'Two diagrams. The topic has two distinct structures that should stay separate.',
  'Three diagrams. The topic has three separate visual ideas.',
  'Four diagrams. The topic has four separate visual ideas.',
  'Five diagrams. The topic is a large system with five distinct structures. Do not choose this for a short or single-concept request.',
] as const;

export const noulAnswerSchema = z.object({
  type: z.literal('noul'),
  noul: z.number().min(0).max(1),
});

const scoreAnswerSchema = z.object({
  type: z.literal('score'),
  score: z.number(),
});

const refusalAnswerSchema = z.object({
  type: z.literal('refusal'),
});

const decisionsResponseSchema = z.object({
  answers: z.record(z.string(), z.unknown()),
});

export interface IEvaluateMermaidDiagramSuitabilityParams {
  userId: string;
  prompt: string;
}

export interface IEvaluateMermaidDiagramSuitabilityResult {
  probability: number;
  suitable: boolean;
}

export interface IEvaluateMermaidDiagramCountResult {
  maxDiagrams: number;
}

export interface IDecisionsTarget {
  url: string;
  model: string;
  apiKey: string;
}

/** The Decisions API lives outside the `/api/v1` prefix of the connection base URL. */
export function buildDecisionsUrl(openRouterBaseUrl?: string): string {
  return new URL(
    DECISIONS_PATH,
    openRouterBaseUrl || DEFAULT_OPENROUTER_BASE_URL,
  ).toString();
}

export function diagramCountFromScore(score: number): number {
  if (!Number.isFinite(score)) {
    throw new Error('Diagram count score must be a finite number');
  }

  const index = Math.min(
    PROMPT_DIAGRAM_COUNT_MAX - PROMPT_DIAGRAM_COUNT_MIN,
    Math.max(0, Math.round(score)),
  );
  return index + PROMPT_DIAGRAM_COUNT_MIN;
}

/** Resolves the OpenRouter Decisions API endpoint for a decision generation kind. */
export async function resolveDecisionsTarget(
  userId: string,
  kind:
    | 'promptDiagramDecision'
    | 'documentNarratableDecision' = 'promptDiagramDecision',
): Promise<IDecisionsTarget> {
  const { route, providerApiKey } = await LlmGenerationRouteResolver.resolve(
    kind,
    { userId },
  );

  if (route.providerType !== 'openrouter') {
    throw new Error(
      `${kind} needs an OpenRouter connection, but the route uses ${route.providerType}`,
    );
  }
  if (!providerApiKey) {
    throw new Error(`OpenRouter credentials are missing for ${kind}`);
  }

  return {
    url: buildDecisionsUrl(route.openRouterBaseUrl),
    model: route.model,
    apiKey: providerApiKey,
  };
}

export async function postDecision(
  target: IDecisionsTarget,
  body: { state: string; questions: Record<string, unknown> },
  /** Abort the request after this long; it then counts as not answered. */
  timeoutMs?: number,
): Promise<Record<string, unknown>> {
  const response = await fetch(target.url, {
    ...(timeoutMs ? { signal: AbortSignal.timeout(timeoutMs) } : {}),
    method: 'POST',
    headers: {
      Authorization: `Bearer ${target.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: target.model, ...body }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Decisions API error ${response.status} (${target.model}): ${errorText.slice(0, 500)}`,
    );
  }

  const json: unknown = await response.json();
  const parsed = decisionsResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error(`Invalid Decisions API response shape (${target.model})`);
  }

  return parsed.data.answers;
}

/** A refusal or a missing answer is "not answered", never a negative verdict. */
export function readAnswer<T>(
  answers: Record<string, unknown>,
  key: string,
  schema: z.ZodType<T>,
  model: string,
): T {
  const answer = answers[key];
  if (refusalAnswerSchema.safeParse(answer).success) {
    throw new Error(`Decision model ${model} declined to answer ${key}`);
  }

  const parsed = schema.safeParse(answer);
  if (!parsed.success) {
    throw new Error(`Decision model ${model} returned no valid ${key} answer`);
  }
  return parsed.data;
}

export async function evaluateMermaidDiagramSuitability(
  params: IEvaluateMermaidDiagramSuitabilityParams,
): Promise<IEvaluateMermaidDiagramSuitabilityResult> {
  const target = await resolveDecisionsTarget(params.userId);
  const answers = await postDecision(target, {
    state: params.prompt,
    questions: {
      mermaid_suitable: {
        type: 'noul',
        instructions:
          'Would Mermaid diagrams help explain this learning document request?',
        criteria: {
          true: 'The topic involves steps, flows, sequences, architecture, state transitions, or relationships that a diagram can clarify.',
          false:
            'The topic is mainly definitions, narrative, lists of facts, or does not benefit from a visual structure.',
        },
      },
    },
  });

  const probability = readAnswer(
    answers,
    'mermaid_suitable',
    noulAnswerSchema,
    target.model,
  ).noul;

  return {
    probability,
    suitable: probability >= DIAGRAM_SUITABILITY_THRESHOLD,
  };
}

export async function evaluateMermaidDiagramCount(
  params: IEvaluateMermaidDiagramSuitabilityParams,
): Promise<IEvaluateMermaidDiagramCountResult> {
  const target = await resolveDecisionsTarget(params.userId);
  const answers = await postDecision(target, {
    state: params.prompt,
    questions: {
      diagram_count: {
        type: 'score',
        instructions:
          'How many Mermaid diagrams should a learning document include for this request? Choose the smallest count that still explains the topic.',
        criteria: [...DIAGRAM_COUNT_CRITERIA],
      },
    },
  });

  const { score } = readAnswer(
    answers,
    'diagram_count',
    scoreAnswerSchema,
    target.model,
  );

  return {
    maxDiagrams: diagramCountFromScore(score),
  };
}
