import { logger } from 'firebase-functions/v2';
import {
  type GenerationKind,
  type IDocumentAgentJobPayload,
  type IScratchPad,
  splitLessonH2Sections,
} from '@shared-types';
import { LlmGenerationService } from '@study-forge/backend-llm/llm';
import { JsonSanitizer } from '@study-forge/backend-llm/llm/json-sanitizer';
import { z } from 'zod';
import { extractBodyHtml } from '../document-html/html-utils';

const scratchPadBatchSchema = z.object({
  pads: z.array(
    z.object({
      sectionIndex: z.number().int().nonnegative(),
      question: z.string().min(1),
      answer: z.string().min(1),
    }),
  ),
});

const scratchPadSingleSchema = z.object({
  question: z.string().min(1),
  answer: z.string().min(1),
});

const scratchPadEvaluateSchema = z.object({
  score: z.number().int().min(1).max(10),
  hint: z.string().optional(),
});

function buildBatchScratchPadsPrompt(
  sections: ReturnType<typeof splitLessonH2Sections>,
  rulesText?: string,
): string {
  const sectionBlocks = sections
    .map(
      (section) =>
        `### Section ${section.sectionIndex}: ${section.heading}\n<section_html>\n${section.html}\n</section_html>`,
    )
    .join('\n\n');

  return [
    'You write short recall questions for a study document.',
    'For each section below, output one open question that can be answered from that section only, and a short answer (a few sentences).',
    'Do not copy sentences verbatim from the section.',
    'Return JSON only: { "pads": [ { "sectionIndex": number, "question": string, "answer": string } ] }',
    'Include exactly one pad per section index listed.',
    rulesText ? `Rules:\n${rulesText}` : '',
    `Sections:\n${sectionBlocks}`,
  ]
    .filter(Boolean)
    .join('\n\n');
}

function buildReplaceScratchPadPrompt(params: {
  heading: string;
  sectionHtml: string;
  avoidedQuestions: string[];
  rulesText?: string;
}): string {
  const avoidBlock =
    params.avoidedQuestions.length > 0
      ? [
          'Do not repeat or closely paraphrase any of these questions:',
          ...params.avoidedQuestions.map(
            (question, index) => `${index + 1}. ${question}`,
          ),
        ].join('\n')
      : 'Write a question that is meaningfully distinct for this section.';

  return [
    'Write a new short open recall question for this lesson section and a short answer.',
    'The new question must differ in meaning from every avoided question below.',
    avoidBlock,
    `Section heading: ${params.heading}`,
    `<section_html>\n${params.sectionHtml}\n</section_html>`,
    'Return JSON only: { "question": string, "answer": string }',
    params.rulesText ? `Rules:\n${params.rulesText}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');
}

function buildEvaluateScratchPadPrompt(params: {
  heading: string;
  sectionHtml: string;
  question: string;
  referenceAnswer: string;
  userAnswer: string;
  rulesText?: string;
}): string {
  return [
    'Grade the learner answer against the reference answer for this recall question.',
    'Return JSON only: { "score": integer from 1 to 10, "hint"?: string }',
    'score 10 means fully correct and complete.',
    'When score is below 10, include a short hint that nudges the learner without stating the full reference answer.',
    'When score is 10, omit hint.',
    `Question: ${params.question}`,
    `Reference answer: ${params.referenceAnswer}`,
    `Learner answer: ${params.userAnswer}`,
    `Section heading: ${params.heading}`,
    `<section_html>\n${params.sectionHtml}\n</section_html>`,
    params.rulesText ? `Rules:\n${params.rulesText}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');
}

function parseScratchPadBatch(
  raw: string,
  lessonSections: ReturnType<typeof splitLessonH2Sections>,
): IScratchPad[] | null {
  try {
    const cleaned = JsonSanitizer.applyStateBased(
      JsonSanitizer.applyComprehensiveCleanup(
        JsonSanitizer.sanitizeJsonText(JsonSanitizer.initialCleanup(raw)),
      ),
    );
    const parsed = scratchPadBatchSchema.safeParse(JSON.parse(cleaned));
    if (!parsed.success) {
      return null;
    }
    const byIndex = new Map(
      parsed.data.pads.map((pad) => [pad.sectionIndex, pad] as const),
    );
    const result: IScratchPad[] = [];
    for (const section of lessonSections) {
      const pad = byIndex.get(section.sectionIndex);
      if (!pad?.question?.trim() || !pad?.answer?.trim()) {
        return null;
      }
      result.push({
        sectionIndex: section.sectionIndex,
        heading: section.heading,
        question: pad.question.trim(),
        answer: pad.answer.trim(),
      });
    }
    return result;
  } catch {
    return null;
  }
}

function parseScratchPadSingle(raw: string): { question: string; answer: string } | null {
  try {
    const cleaned = JsonSanitizer.applyStateBased(
      JsonSanitizer.applyComprehensiveCleanup(
        JsonSanitizer.sanitizeJsonText(JsonSanitizer.initialCleanup(raw)),
      ),
    );
    const parsed = scratchPadSingleSchema.safeParse(JSON.parse(cleaned));
    if (!parsed.success) {
      return null;
    }
    return {
      question: parsed.data.question.trim(),
      answer: parsed.data.answer.trim(),
    };
  } catch {
    return null;
  }
}

export function shouldGenerateScratchPads(params: {
  generationKind: GenerationKind;
  payload: IDocumentAgentJobPayload;
}): boolean {
  if (params.generationKind !== 'documentFromPrompt') {
    return false;
  }
  if (params.payload.sourceKind !== 'prompt') {
    return false;
  }
  return params.payload.includeScratchPads !== false;
}

export async function generateScratchPadsForDocument(params: {
  userId: string;
  htmlFragment: string;
  rulesText?: string;
}): Promise<IScratchPad[]> {
  const bodyHtml = extractBodyHtml(params.htmlFragment);
  const lessonSections = splitLessonH2Sections(bodyHtml);
  if (lessonSections.length === 0) {
    return [];
  }

  const prompt = buildBatchScratchPadsPrompt(lessonSections, params.rulesText);

  const attempt = async (): Promise<IScratchPad[] | null> => {
    try {
      const raw = await LlmGenerationService.generateText(
        params.userId,
        'documentFromPrompt',
        prompt,
        {
          logLabel: 'scratch-pads-batch',
          profile: 'structuredArtifact',
        },
      );
      return parseScratchPadBatch(raw, lessonSections);
    } catch (error) {
      logger.warn('Scratch pad batch generation failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  };

  const first = await attempt();
  if (first) {
    return first;
  }
  const second = await attempt();
  if (second) {
    return second;
  }

  logger.warn('Scratch pad generation failed after retry', {
    userId: params.userId,
    sectionCount: lessonSections.length,
  });
  return [];
}

function parseScratchPadEvaluation(
  raw: string,
): { score: number; hint?: string } | null {
  try {
    const cleaned = JsonSanitizer.applyStateBased(
      JsonSanitizer.applyComprehensiveCleanup(
        JsonSanitizer.sanitizeJsonText(JsonSanitizer.initialCleanup(raw)),
      ),
    );
    const parsed = scratchPadEvaluateSchema.safeParse(JSON.parse(cleaned));
    if (!parsed.success) {
      return null;
    }
    const hint = parsed.data.hint?.trim();
    return {
      score: parsed.data.score,
      ...(parsed.data.score < 10 && hint ? { hint } : {}),
    };
  } catch {
    return null;
  }
}

export async function regenerateScratchPadForSection(params: {
  userId: string;
  heading: string;
  sectionHtml: string;
  sectionIndex: number;
  avoidedQuestions: string[];
  rulesText?: string;
}): Promise<IScratchPad | null> {
  const prompt = buildReplaceScratchPadPrompt({
    heading: params.heading,
    sectionHtml: params.sectionHtml,
    avoidedQuestions: params.avoidedQuestions,
    rulesText: params.rulesText,
  });

  try {
    const raw = await LlmGenerationService.generateText(
      params.userId,
      'scratchPadQuestion',
      prompt,
      {
        logLabel: 'scratch-pad-regenerate',
        profile: 'explanatoryChat',
      },
    );
    const parsed = parseScratchPadSingle(raw);
    if (!parsed) {
      return null;
    }
    return {
      sectionIndex: params.sectionIndex,
      heading: params.heading,
      question: parsed.question,
      answer: parsed.answer,
      avoidedQuestions: params.avoidedQuestions,
    };
  } catch (error) {
    logger.warn('Scratch pad regeneration failed', {
      error: error instanceof Error ? error.message : String(error),
      sectionIndex: params.sectionIndex,
    });
    return null;
  }
}

export async function evaluateScratchPadAnswer(params: {
  userId: string;
  heading: string;
  sectionHtml: string;
  question: string;
  referenceAnswer: string;
  userAnswer: string;
  rulesText?: string;
}): Promise<{ score: number; hint?: string } | null> {
  const prompt = buildEvaluateScratchPadPrompt({
    heading: params.heading,
    sectionHtml: params.sectionHtml,
    question: params.question,
    referenceAnswer: params.referenceAnswer,
    userAnswer: params.userAnswer,
    rulesText: params.rulesText,
  });

  try {
    const raw = await LlmGenerationService.generateText(
      params.userId,
      'scratchPadQuestion',
      prompt,
      {
        logLabel: 'scratch-pad-evaluate',
        profile: 'explanatoryChat',
      },
    );
    return parseScratchPadEvaluation(raw);
  } catch (error) {
    logger.warn('Scratch pad answer evaluation failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export async function resolveScratchPadsForPromptCompletion(params: {
  userId: string;
  htmlFragment: string;
  generationKind: GenerationKind;
  payload: IDocumentAgentJobPayload;
  rulesText?: string;
}): Promise<IScratchPad[] | undefined> {
  if (!shouldGenerateScratchPads(params)) {
    return undefined;
  }
  const pads = await generateScratchPadsForDocument({
    userId: params.userId,
    htmlFragment: params.htmlFragment,
    rulesText: params.rulesText,
  });
  return pads.length > 0 ? pads : undefined;
}
