import { extractFinalReply } from './final-response';
import { extractRetrievedTexts } from './platform-knowledge';
import { callTogetherBooleanJudge } from './together-judge';
import { isKvMap, type IEvalExampleLike, type IEvalRunLike } from '../shared/eval-types';

const CORRECTNESS_INSTRUCTIONS = `You are a teacher grading a quiz. You will be given a QUESTION, the GROUND TRUTH (correct) ANSWER, and the STUDENT ANSWER. Here is the grade criteria to follow:
(1) Grade the student answers based ONLY on their factual accuracy relative to the ground truth answer. (2) Ensure that the student answer does not contain any conflicting statements.
(3) It is OK if the student answer contains more information than the ground truth answer, as long as it is factually accurate relative to the  ground truth answer.

Correctness:
A correctness value of True means that the student's answer meets all of the criteria.
A correctness value of False means that the student's answer does not meet all of the criteria.

Set correct first. Then write one or two sentences.`;

const RELEVANCE_INSTRUCTIONS = `You are a teacher grading a quiz. You will be given a QUESTION and a STUDENT ANSWER. Here is the grade criteria to follow:
(1) Ensure the STUDENT ANSWER is concise and relevant to the QUESTION
(2) Ensure the STUDENT ANSWER helps to answer the QUESTION

Relevance:
A relevance value of True means that the student's answer meets all of the criteria.
A relevance value of False means that the student's answer does not meet all of the criteria.

Set relevant first. Then write one or two sentences.`;

const GROUNDEDNESS_INSTRUCTIONS = `You are a teacher grading a quiz. You will be given FACTS and a STUDENT ANSWER. Here is the grade criteria to follow:
(1) Ensure the STUDENT ANSWER is grounded in the FACTS. (2) Ensure the STUDENT ANSWER does not contain "hallucinated" information outside the scope of the FACTS.

Grounded:
A grounded value of True means that the student's answer meets all of the criteria.
A grounded value of False means that the student's answer does not meet all of the criteria.

Set grounded first. Then write one or two sentences.`;

const RETRIEVAL_RELEVANCE_INSTRUCTIONS = `You are a teacher grading a quiz. You will be given a QUESTION and a set of FACTS provided by the student. Here is the grade criteria to follow:
(1) You goal is to identify FACTS that are completely unrelated to the QUESTION
(2) If the facts contain ANY keywords or semantic meaning related to the question, consider them relevant
(3) It is OK if the facts have SOME information that is unrelated to the question as long as (2) is met

Relevance:
A relevance value of True means that the FACTS contain ANY keywords or semantic meaning related to the QUESTION and are therefore relevant.
A relevance value of False means that the FACTS are completely unrelated to the QUESTION.

Set relevant first. Then write one or two sentences.`;

function readObjective(example: IEvalExampleLike | undefined): string {
  if (!isKvMap(example?.inputs)) {
    return '';
  }
  return typeof example.inputs.objective === 'string'
    ? example.inputs.objective
    : '';
}

function readGoldFinalReply(example: IEvalExampleLike | undefined): string {
  if (!isKvMap(example?.outputs)) {
    return '';
  }
  return typeof example.outputs.finalReply === 'string'
    ? example.outputs.finalReply
    : '';
}

function joinRetrievedTexts(texts: string[]): string {
  return texts.join('\n\n');
}

export async function correctnessEvaluator(
  run: IEvalRunLike,
  example?: IEvalExampleLike,
): Promise<{ key: string; score: number; comment: string }> {
  const objective = readObjective(example);
  const gold = readGoldFinalReply(example);
  const actual = extractFinalReply(run);

  if (!gold.trim()) {
    return {
      key: 'correctness',
      score: 0,
      comment: 'Example is missing outputs.finalReply gold criteria.',
    };
  }

  const userContent = `QUESTION: ${objective}
GROUND TRUTH ANSWER: ${gold}
STUDENT ANSWER: ${actual}`;

  const grade = await callTogetherBooleanJudge({
    metric: 'correctness',
    systemInstructions: CORRECTNESS_INSTRUCTIONS,
    userContent,
    booleanField: 'correct',
  });

  return { key: 'correctness', ...grade };
}

export async function relevanceEvaluator(
  run: IEvalRunLike,
  example?: IEvalExampleLike,
): Promise<{ key: string; score: number; comment: string }> {
  const objective = readObjective(example);
  const actual = extractFinalReply(run);
  const userContent = `QUESTION: ${objective}
STUDENT ANSWER: ${actual}`;

  const grade = await callTogetherBooleanJudge({
    metric: 'relevance',
    systemInstructions: RELEVANCE_INSTRUCTIONS,
    userContent,
    booleanField: 'relevant',
  });

  return { key: 'relevance', ...grade };
}

export async function groundednessEvaluator(
  run: IEvalRunLike,
): Promise<{ key: string; score: number; comment: string }> {
  const actual = extractFinalReply(run);
  const chunks = extractRetrievedTexts(run);

  if (chunks.length === 0) {
    return {
      key: 'groundedness',
      score: 0,
      comment: 'No retrievedTexts on the run; cannot grade groundedness.',
    };
  }

  const userContent = `FACTS: ${joinRetrievedTexts(chunks)}
STUDENT ANSWER: ${actual}`;

  const grade = await callTogetherBooleanJudge({
    metric: 'groundedness',
    systemInstructions: GROUNDEDNESS_INSTRUCTIONS,
    userContent,
    booleanField: 'grounded',
  });

  return { key: 'groundedness', ...grade };
}

export async function retrievalRelevanceEvaluator(
  run: IEvalRunLike,
  example?: IEvalExampleLike,
): Promise<{ key: string; score: number; comment: string }> {
  const objective = readObjective(example);
  const chunks = extractRetrievedTexts(run);

  if (chunks.length === 0) {
    return {
      key: 'retrieval_relevance',
      score: 0,
      comment: 'No retrievedTexts on the run; cannot grade retrieval relevance.',
    };
  }

  const userContent = `FACTS: ${joinRetrievedTexts(chunks)}
QUESTION: ${objective}`;

  const grade = await callTogetherBooleanJudge({
    metric: 'retrieval_relevance',
    systemInstructions: RETRIEVAL_RELEVANCE_INSTRUCTIONS,
    userContent,
    booleanField: 'relevant',
  });

  return { key: 'retrieval_relevance', ...grade };
}

export function selfCheckRagLlmJudges(): void {
  const run: IEvalRunLike = {
    outputs: {
      finalReply: 'A document from prompt costs 20 credits.',
      retrievedTexts: ['documentFromPrompt costs 20 credits'],
    },
  };
  const example: IEvalExampleLike = {
    inputs: { objective: 'How many credits does a document from prompt cost?' },
    outputs: {
      finalReply:
        'State that documentFromPrompt / document from prompt costs 20 credits.',
    },
  };

  const objective = readObjective(example);
  const gold = readGoldFinalReply(example);
  const reply = extractFinalReply(run);
  const chunks = extractRetrievedTexts(run);

  if (
    objective.length === 0 ||
    gold.length === 0 ||
    reply.length === 0 ||
    chunks.length === 0
  ) {
    throw new Error('RAG judge self-check failed: extractor shape mismatch.');
  }

  console.log(
    'RAG LLM judge self-check passed (objective, gold, reply, retrievedTexts extractors).',
  );
}

export function ragLlmJudgeEvaluators(): Array<
  (
    run: IEvalRunLike,
    example?: IEvalExampleLike,
  ) => Promise<{ key: string; score: number; comment: string }>
> {
  return [
    correctnessEvaluator,
    relevanceEvaluator,
    groundednessEvaluator,
    retrievalRelevanceEvaluator,
  ];
}
