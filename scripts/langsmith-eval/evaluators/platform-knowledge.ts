import { extractFinalReply } from './final-response';
import type { IEvalExampleLike, IEvalRunLike } from '../shared/eval-types';
import { isKvMap } from '../shared/eval-types';

function readStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is string => typeof entry === 'string');
}

function includesInsensitive(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

export function extractRetrievedTexts(run: IEvalRunLike): string[] {
  const outputs = isKvMap(run.outputs) ? run.outputs : {};
  const texts = outputs.retrievedTexts;
  if (Array.isArray(texts)) {
    return texts.filter((entry): entry is string => typeof entry === 'string');
  }
  const joined = outputs.retrievedText;
  return typeof joined === 'string' && joined.trim().length > 0 ? [joined] : [];
}

export function extractExpectedChunkPhrases(
  example: IEvalExampleLike,
): string[] {
  const outputs = isKvMap(example.outputs) ? example.outputs : {};
  return readStringList(outputs.expectedChunkPhrases).filter(
    (phrase) => phrase.trim().length > 0,
  );
}

export function extractMustContain(example: IEvalExampleLike): string[] {
  const outputs = isKvMap(example.outputs) ? example.outputs : {};
  return readStringList(outputs.mustContain).filter(
    (phrase) => phrase.trim().length > 0,
  );
}

export function extractMustNotContain(example: IEvalExampleLike): string[] {
  const outputs = isKvMap(example.outputs) ? example.outputs : {};
  return readStringList(outputs.mustNotContain).filter(
    (phrase) => phrase.trim().length > 0,
  );
}

export function retrievalRecallEvaluator(
  run: IEvalRunLike,
  example: IEvalExampleLike,
): { key: string; score: number; comment: string } {
  const phrases = extractExpectedChunkPhrases(example);
  const chunks = extractRetrievedTexts(run);
  const joined = chunks.join('\n');

  if (phrases.length === 0) {
    return {
      key: 'retrieval_recall',
      score: 1,
      comment: 'No expectedChunkPhrases on the example.',
    };
  }

  if (chunks.length === 0) {
    return {
      key: 'retrieval_recall',
      score: 0,
      comment: `Required ${phrases.length} phrase(s) but retrieved 0 chunks.`,
    };
  }

  const hits = phrases.filter((phrase) => includesInsensitive(joined, phrase));
  const score = hits.length / phrases.length;
  return {
    key: 'retrieval_recall',
    score,
    comment: `Matched ${hits.length}/${phrases.length} phrases in ${chunks.length} chunk(s).`,
  };
}

export function policyFactsEvaluator(
  run: IEvalRunLike,
  example: IEvalExampleLike,
): { key: string; score: number; comment: string } {
  const reply = extractFinalReply(run);
  const mustContain = extractMustContain(example);
  const mustNotContain = extractMustNotContain(example);

  const missing = mustContain.filter(
    (phrase) => !includesInsensitive(reply, phrase),
  );
  const bannedHits = mustNotContain.filter((phrase) =>
    includesInsensitive(reply, phrase),
  );

  const pass = missing.length === 0 && bannedHits.length === 0;
  return {
    key: 'policy_facts',
    score: pass ? 1 : 0,
    comment: pass
      ? 'All mustContain present; no mustNotContain hits.'
      : [
          missing.length > 0 ? `missing: ${missing.join(', ')}` : '',
          bannedHits.length > 0 ? `banned: ${bannedHits.join(', ')}` : '',
        ]
          .filter((part) => part.length > 0)
          .join('; '),
  };
}

export function selfCheckPlatformKnowledgeEvaluators(): void {
  const retrievalPass = retrievalRecallEvaluator(
    { outputs: { retrievedTexts: ['documentFromPrompt costs 20 credits'] } },
    { outputs: { expectedChunkPhrases: ['documentFromPrompt', '20'] } },
  );
  const retrievalEmpty = retrievalRecallEvaluator(
    { outputs: { retrievedTexts: [] } },
    { outputs: { expectedChunkPhrases: ['20'] } },
  );
  const factsPass = policyFactsEvaluator(
    { outputs: { finalReply: 'A document from prompt costs 20 credits.' } },
    { outputs: { mustContain: ['20'], mustNotContain: ['created a quiz'] } },
  );
  const factsFail = policyFactsEvaluator(
    { outputs: { finalReply: 'I created a diagram quiz.' } },
    {
      outputs: {
        mustContain: ['app generator'],
        mustNotContain: ['created a diagram quiz'],
      },
    },
  );

  if (
    retrievalPass.score !== 1 ||
    retrievalEmpty.score !== 0 ||
    factsPass.score !== 1 ||
    factsFail.score !== 0
  ) {
    throw new Error(
      `Platform knowledge evaluator self-check failed: recallPass=${retrievalPass.score} recallEmpty=${retrievalEmpty.score} factsPass=${factsPass.score} factsFail=${factsFail.score}`,
    );
  }
  console.log(
    'Platform knowledge evaluator self-check passed (retrieval_recall, policy_facts).',
  );
}

export function retrievalRecallLangsmithEvaluators(): Array<
  (
    run: IEvalRunLike,
    example?: IEvalExampleLike,
  ) => Promise<{
    key: string;
    score: number;
    comment: string;
  }>
> {
  return [
    async (run, example) =>
      retrievalRecallEvaluator(run, example ?? { outputs: {} }),
  ];
}

export function policyFactsLangsmithEvaluators(): Array<
  (
    run: IEvalRunLike,
    example?: IEvalExampleLike,
  ) => Promise<{
    key: string;
    score: number;
    comment: string;
  }>
> {
  return [
    async (run, example) =>
      policyFactsEvaluator(run, example ?? { outputs: {} }),
  ];
}
