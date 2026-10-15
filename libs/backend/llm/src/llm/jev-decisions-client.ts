import { z } from 'zod';
import {
  PRIMARY_OPENROUTER_CONNECTION_ID,
  PROMPT_DIAGRAM_COUNT_MAX,
  PROMPT_DIAGRAM_COUNT_MIN,
} from '@shared-types';
import { ProviderConnectionRepository } from './provider-connection-repository';
import { decryptLlmSecret } from './llm-secret-resolver';

export const JEV_DECISIONS_MODEL = 'typesafe/jev-1.13';
export const JEV_DECISIONS_URL = 'https://openrouter.ai/api/alpha/decisions';
export const JEV_DIAGRAM_SUITABILITY_THRESHOLD = 0.6;

const DIAGRAM_COUNT_CRITERIA = [
  'One diagram. The topic has a single flow, structure, or relationship.',
  'Two diagrams. The topic has two distinct structures that should stay separate.',
  'Three diagrams. The topic has three separate visual ideas.',
  'Four diagrams. The topic has four separate visual ideas.',
  'Five diagrams. The topic is a large system with five distinct structures. Do not choose this for a short or single-concept request.',
] as const;

const noulAnswerSchema = z.object({
  type: z.literal('noul'),
  noul: z.number().min(0).max(1),
});

const scoreAnswerSchema = z.object({
  type: z.literal('score'),
  score: z.number(),
});

const decisionsResponseSchema = z.object({
  answers: z.record(z.string(), z.unknown()),
});

async function resolveOpenRouterApiKey(): Promise<string> {
  const encrypted = await ProviderConnectionRepository.getEncryptedSecret(
    PRIMARY_OPENROUTER_CONNECTION_ID,
  );
  if (!encrypted) {
    throw new Error('OpenRouter provider connection is not configured');
  }
  return decryptLlmSecret(encrypted);
}

export interface IEvaluateMermaidDiagramSuitabilityParams {
  prompt: string;
}

export interface IEvaluateMermaidDiagramSuitabilityResult {
  probability: number;
  suitable: boolean;
}

export interface IEvaluateMermaidDiagramCountResult {
  maxDiagrams: number;
}

export function diagramCountFromJevScore(score: number): number {
  if (!Number.isFinite(score)) {
    throw new Error('Jev diagram count score must be a finite number');
  }

  const index = Math.min(
    PROMPT_DIAGRAM_COUNT_MAX - PROMPT_DIAGRAM_COUNT_MIN,
    Math.max(0, Math.round(score)),
  );
  return index + PROMPT_DIAGRAM_COUNT_MIN;
}

async function postJevDecision(body: unknown): Promise<Record<string, unknown>> {
  const apiKey = await resolveOpenRouterApiKey();
  const response = await fetch(JEV_DECISIONS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Jev Decisions API error ${response.status}: ${errorText.slice(0, 500)}`,
    );
  }

  const json: unknown = await response.json();
  const parsed = decisionsResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error('Invalid Jev Decisions API response shape');
  }

  return parsed.data.answers;
}

export async function evaluateMermaidDiagramSuitability(
  params: IEvaluateMermaidDiagramSuitabilityParams,
): Promise<IEvaluateMermaidDiagramSuitabilityResult> {
  const answers = await postJevDecision({
    model: JEV_DECISIONS_MODEL,
    state: params.prompt,
    questions: {
      mermaid_suitable: {
        type: 'noul',
        instructions:
          'Would Mermaid diagrams help explain this learning document request?',
        criteria: {
          true:
            'The topic involves steps, flows, sequences, architecture, state transitions, or relationships that a diagram can clarify.',
          false:
            'The topic is mainly definitions, narrative, lists of facts, or does not benefit from a visual structure.',
        },
      },
    },
  });

  const parsedAnswer = noulAnswerSchema.safeParse(answers.mermaid_suitable);
  if (!parsedAnswer.success) {
    throw new Error('Jev response missing mermaid_suitable answer');
  }

  const probability = parsedAnswer.data.noul;
  return {
    probability,
    suitable: probability >= JEV_DIAGRAM_SUITABILITY_THRESHOLD,
  };
}

export async function evaluateMermaidDiagramCount(
  params: IEvaluateMermaidDiagramSuitabilityParams,
): Promise<IEvaluateMermaidDiagramCountResult> {
  const answers = await postJevDecision({
    model: JEV_DECISIONS_MODEL,
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

  const parsedAnswer = scoreAnswerSchema.safeParse(answers.diagram_count);
  if (!parsedAnswer.success) {
    throw new Error('Jev response missing diagram_count answer');
  }

  return {
    maxDiagrams: diagramCountFromJevScore(parsedAnswer.data.score),
  };
}
