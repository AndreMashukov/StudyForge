import { z } from 'zod';
import {
  PRIMARY_OPENROUTER_CONNECTION_ID,
} from '@shared-types';
import { ProviderConnectionRepository } from './provider-connection-repository';
import { decryptLlmSecret } from './llm-secret-resolver';

export const JEV_DECISIONS_MODEL = 'typesafe/jev-1.13';
export const JEV_DECISIONS_URL = 'https://openrouter.ai/api/alpha/decisions';
export const JEV_DIAGRAM_SUITABILITY_THRESHOLD = 0.6;

const noulAnswerSchema = z.object({
  type: z.literal('noul'),
  noul: z.number().min(0).max(1),
});

const decisionsResponseSchema = z.object({
  answers: z.record(z.string(), noulAnswerSchema),
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

export async function evaluateMermaidDiagramSuitability(
  params: IEvaluateMermaidDiagramSuitabilityParams,
): Promise<IEvaluateMermaidDiagramSuitabilityResult> {
  const apiKey = await resolveOpenRouterApiKey();

  const body = {
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
  };

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

  const answer = parsed.data.answers.mermaid_suitable;
  if (!answer) {
    throw new Error('Jev response missing mermaid_suitable answer');
  }

  const probability = answer.noul;
  return {
    probability,
    suitable: probability >= JEV_DIAGRAM_SUITABILITY_THRESHOLD,
  };
}
