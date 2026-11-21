import { NARRATABLE_PROBABILITY_THRESHOLD } from '@shared-types';
import {
  noulAnswerSchema,
  postDecision,
  readAnswer,
  resolveDecisionsTarget,
} from './prompt-diagram-decisions-client';

/**
 * Narratable check: asks a decision model whether a sample of a document's
 * prose is English that makes sense read aloud. The model comes from the
 * `documentNarratableDecision` generation route.
 */

export interface IEvaluateDocumentNarratableParams {
  userId: string;
  /** Prose sample, already stripped of code, tables and diagrams. */
  proseSample: string;
}

export interface IEvaluateDocumentNarratableResult {
  probability: number;
  narratable: boolean;
}

export async function evaluateDocumentNarratable(
  params: IEvaluateDocumentNarratableParams,
): Promise<IEvaluateDocumentNarratableResult> {
  const target = await resolveDecisionsTarget(
    params.userId,
    'documentNarratableDecision',
  );
  const answers = await postDecision(target, {
    state: params.proseSample,
    questions: {
      narratable_english: {
        type: 'noul',
        instructions:
          'Is this text written in English, and would it make sense to a learner listening to it read aloud?',
        criteria: {
          true: 'The text is English prose: explanations, narrative, definitions or instructions that a listener can follow without seeing the page.',
          false:
            'The text is mostly in another language, or is mainly code, formulas, data, lists of symbols, references or fragments that need to be seen to be understood.',
        },
      },
    },
  });

  const probability = readAnswer(
    answers,
    'narratable_english',
    noulAnswerSchema,
    target.model,
  ).noul;

  return {
    probability,
    narratable: probability >= NARRATABLE_PROBABILITY_THRESHOLD,
  };
}
