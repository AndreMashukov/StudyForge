import { isKvMap } from '../shared/eval-types';

const TOGETHER_MODEL = 'zai-org/GLM-5.2';
const DEFAULT_MAX_TOKENS = 200;

export function isTogetherJudgeConfigured(): boolean {
  const apiKey = process.env.TOGETHER_AI_API_KEY;
  return Boolean(
    apiKey && !apiKey.includes('your_') && !apiKey.startsWith('demo-'),
  );
}

export function missingTogetherJudgeComment(metric: string): string {
  return `Skipped: TOGETHER_AI_API_KEY is missing, so ${metric} was not graded.`;
}

type BooleanGradeField = 'correct' | 'relevant' | 'grounded';

function booleanGradeSchema(booleanField: BooleanGradeField): Record<string, unknown> {
  return {
    type: 'object',
    properties: {
      [booleanField]: {
        type: 'boolean',
        description: 'True if the grade criteria are met.',
      },
      explanation: {
        type: 'string',
        description: 'One or two sentences. Do not write a long chain of thought.',
      },
    },
    required: [booleanField, 'explanation'],
    additionalProperties: false,
  };
}

const SCORE_GRADE_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    score: {
      type: 'integer',
      enum: [0, 1],
      description: '1 if the criteria are met, otherwise 0.',
    },
    comment: {
      type: 'string',
      description: 'One or two sentences. Do not write a long chain of thought.',
    },
  },
  required: ['score', 'comment'],
  additionalProperties: false,
};

function togetherReasoningExtras(): Record<string, unknown> {
  return {
    reasoning: { enabled: false },
    thinking: { type: 'disabled' },
  };
}

function jsonSchemaResponseFormat(
  name: string,
  schema: Record<string, unknown>,
): Record<string, unknown> {
  return {
    type: 'json_schema',
    json_schema: {
      name,
      schema,
      strict: true,
    },
  };
}

function jsonObjectResponseFormat(
  schema: Record<string, unknown>,
): Record<string, unknown> {
  return {
    type: 'json_object',
    schema,
  };
}

function readChatCompletionText(payload: unknown): string {
  if (!isKvMap(payload) || !Array.isArray(payload.choices)) {
    return '';
  }
  const first = payload.choices[0];
  if (!isKvMap(first) || !isKvMap(first.message)) {
    return '';
  }
  return typeof first.message.content === 'string' ? first.message.content : '';
}

function stripJsonFence(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return fenced ? fenced[1].trim() : trimmed;
}

function parseBooleanJudgeJson(
  raw: string,
  booleanField: string,
): { score: number; comment: string } | null {
  const candidates = [stripJsonFence(raw)];
  const embedded = raw.match(/\{[\s\S]*\}/);
  if (embedded) {
    candidates.push(embedded[0]);
  }

  for (const candidate of candidates) {
    try {
      const parsed: unknown = JSON.parse(candidate);
      if (!isKvMap(parsed)) {
        continue;
      }
      const boolValue = parsed[booleanField];
      const score = boolValue === true || boolValue === 1 ? 1 : 0;
      const comment =
        typeof parsed.explanation === 'string'
          ? parsed.explanation
          : 'No explanation';
      return { score, comment };
    } catch {
      continue;
    }
  }

  const truePattern = new RegExp(`"${booleanField}"\\s*:\\s*true\\b`);
  const falsePattern = new RegExp(`"${booleanField}"\\s*:\\s*false\\b`);
  if (truePattern.test(raw)) {
    return {
      score: 1,
      comment: `Judge JSON was truncated; ${booleanField} was true.`,
    };
  }
  if (falsePattern.test(raw)) {
    return {
      score: 0,
      comment: `Judge JSON was truncated; ${booleanField} was false.`,
    };
  }
  return null;
}

function parseScoreJudgeJson(
  raw: string,
): { score: number; comment: string } | null {
  const candidates = [stripJsonFence(raw)];
  const embedded = raw.match(/\{[\s\S]*\}/);
  if (embedded) {
    candidates.push(embedded[0]);
  }

  for (const candidate of candidates) {
    try {
      const parsed: unknown = JSON.parse(candidate);
      if (!isKvMap(parsed)) {
        continue;
      }
      const score = parsed.score === 1 || parsed.score === true ? 1 : 0;
      const comment =
        typeof parsed.comment === 'string' ? parsed.comment : 'No comment';
      return { score, comment };
    } catch {
      continue;
    }
  }

  if (/"score"\s*:\s*1\b/.test(raw)) {
    return {
      score: 1,
      comment: 'Judge JSON was truncated; score field was 1.',
    };
  }
  if (/"score"\s*:\s*0\b/.test(raw)) {
    return {
      score: 0,
      comment: 'Judge JSON was truncated; score field was 0.',
    };
  }
  return null;
}

async function postTogetherChat(input: {
  systemContent: string;
  userContent: string;
  maxTokens: number;
  responseFormat: Record<string, unknown>;
}): Promise<{ ok: true; text: string } | { ok: false; status: number; comment: string }> {
  const apiKey = process.env.TOGETHER_AI_API_KEY;
  if (!apiKey || apiKey.includes('your_') || apiKey.startsWith('demo-')) {
    return { ok: false, status: 0, comment: 'TOGETHER_AI_API_KEY is missing.' };
  }

  const response = await fetch('https://api.together.xyz/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: TOGETHER_MODEL,
      temperature: 0,
      max_tokens: input.maxTokens,
      ...togetherReasoningExtras(),
      response_format: input.responseFormat,
      messages: [
        { role: 'system', content: input.systemContent },
        { role: 'user', content: input.userContent },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    return {
      ok: false,
      status: response.status,
      comment: `Together judge HTTP ${response.status}: ${body.slice(0, 200)}`,
    };
  }

  const payload: unknown = await response.json();
  return { ok: true, text: stripJsonFence(readChatCompletionText(payload)) };
}

async function callTogetherChat(input: {
  systemContent: string;
  userContent: string;
  maxTokens?: number;
  schemaName: string;
  schema: Record<string, unknown>;
}): Promise<{ ok: true; text: string } | { ok: false; comment: string }> {
  const maxTokens = input.maxTokens ?? DEFAULT_MAX_TOKENS;
  const structured = await postTogetherChat({
    ...input,
    maxTokens,
    responseFormat: jsonSchemaResponseFormat(input.schemaName, input.schema),
  });
  if (structured.ok) {
    return structured;
  }
  if (structured.status === 400) {
    const loose = await postTogetherChat({
      ...input,
      maxTokens,
      responseFormat: jsonObjectResponseFormat(input.schema),
    });
    if (loose.ok) {
      return loose;
    }
    return { ok: false, comment: loose.comment };
  }
  return { ok: false, comment: structured.comment };
}

export async function callTogetherBooleanJudge(input: {
  metric: string;
  systemInstructions: string;
  userContent: string;
  booleanField: BooleanGradeField;
}): Promise<{ score: number; comment: string }> {
  if (!isTogetherJudgeConfigured()) {
    return {
      score: 0,
      comment: missingTogetherJudgeComment(input.metric),
    };
  }

  const schema = booleanGradeSchema(input.booleanField);
  const chat = await callTogetherChat({
    systemContent: `Return JSON only. Put "${input.booleanField}" first, then a one or two sentence explanation. No markdown.`,
    userContent: `${input.systemInstructions}\n\n${input.userContent}`,
    schemaName: `${input.metric}_grade`,
    schema,
  });
  if (!chat.ok) {
    return { score: 0, comment: chat.comment };
  }

  const parsed = parseBooleanJudgeJson(chat.text, input.booleanField);
  if (!parsed) {
    return {
      score: 0,
      comment: `Judge returned unparseable JSON: ${chat.text.slice(0, 200)}`,
    };
  }
  return parsed;
}

export async function callTogetherScoreJudge(input: {
  metric: string;
  systemContent: string;
  userContent: string;
  maxTokens?: number;
}): Promise<{ score: number; comment: string }> {
  if (!isTogetherJudgeConfigured()) {
    return {
      score: 0,
      comment: missingTogetherJudgeComment(input.metric),
    };
  }

  const chat = await callTogetherChat({
    systemContent: input.systemContent,
    userContent: input.userContent,
    maxTokens: input.maxTokens ?? DEFAULT_MAX_TOKENS,
    schemaName: `${input.metric}_grade`,
    schema: SCORE_GRADE_SCHEMA,
  });
  if (!chat.ok) {
    return { score: 0, comment: chat.comment };
  }

  const parsed = parseScoreJudgeJson(chat.text);
  if (!parsed) {
    return {
      score: 0,
      comment: `Judge returned unparseable JSON: ${chat.text.slice(0, 200)}`,
    };
  }
  return parsed;
}
