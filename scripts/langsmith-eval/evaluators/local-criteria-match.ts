import {
  cannedFallbackEvaluator,
  extractFinalReply,
  nonemptyReplyEvaluator,
} from './final-response';
import { callTogetherScoreJudge } from './together-judge';
import { CANNED_FALLBACK } from '../shared/constants';
import { isKvMap, type IEvalExampleLike, type IEvalRunLike } from '../shared/eval-types';

export async function gradeCriteriaMatch(input: {
  objective: string;
  criteria: string;
  actual: string;
}): Promise<{ score: number; comment: string }> {
  const prompt = [
    'You grade a StudyForge workspace agent final reply.',
    'score=1 if the actual reply satisfies the expected criteria. Partial-but-honest answers can score 1.',
    'score=0 if it invents ids, creates a forbidden artifact kind, uses the canned planner fallback, or misses the required behavior.',
    `User objective:\n${input.objective}`,
    `Expected criteria:\n${input.criteria}`,
    `Actual finalReply:\n${input.actual}`,
  ].join('\n\n');

  return callTogetherScoreJudge({
    metric: 'criteria_match',
    systemContent:
      'Return JSON only. Put score first (0 or 1), then a one or two sentence comment. No markdown.',
    userContent: prompt,
  });
}

export function selfCheckFinalResponseEvaluators(): void {
  const failRun: IEvalRunLike = { outputs: { finalReply: CANNED_FALLBACK } };
  const passRun: IEvalRunLike = {
    outputs: { finalReply: 'Here is a complete listing of Study Materials.' },
  };
  const example: IEvalExampleLike = {
    outputs: { mustNotContain: CANNED_FALLBACK },
  };

  const failScore = cannedFallbackEvaluator(failRun, example).score;
  const passScore = cannedFallbackEvaluator(passRun, example).score;
  const emptyScore = nonemptyReplyEvaluator({
    outputs: { finalReply: '' },
  }).score;
  if (failScore !== 0 || passScore !== 1 || emptyScore !== 0) {
    throw new Error(
      `Evaluator self-check failed: fallbackFail=${failScore} fallbackPass=${passScore} empty=${emptyScore}`,
    );
  }
  console.log(
    'Evaluator self-check passed (known good/bad finalReply shapes).',
  );
}

export function localFinalResponseEvaluators(): Array<
  (
    run: IEvalRunLike,
    example?: IEvalExampleLike,
  ) => Promise<{
    key?: string;
    score: number;
    comment: string;
  }>
> {
  return [
    async (run, example) =>
      cannedFallbackEvaluator(run, example ?? { outputs: {} }),
    async (run) => nonemptyReplyEvaluator(run),
    async (run, example) => {
      const actual = extractFinalReply(run);
      const outputs = isKvMap(example?.outputs) ? example.outputs : {};
      const criteria =
        typeof outputs.finalReply === 'string'
          ? outputs.finalReply
          : 'Satisfy the labeled case.';
      const objective =
        isKvMap(example?.inputs) && typeof example.inputs.objective === 'string'
          ? example.inputs.objective
          : '';
      const grade = await gradeCriteriaMatch({
        objective,
        criteria,
        actual,
      });
      return {
        key: 'criteria_match',
        score: grade.score,
        comment: grade.comment,
      };
    },
  ];
}
