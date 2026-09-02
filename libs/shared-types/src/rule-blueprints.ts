import { z } from 'zod';
import type { RuleApplicability, RuleColor } from './index';

export type RuleBlueprintStatus = 'draft' | 'published' | 'archived';

export interface IRuleBlueprint {
  id: string;
  name: string;
  description?: string;
  content: string;
  color: RuleColor;
  tags: string[];
  applicableTo: RuleApplicability[];
  status: RuleBlueprintStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
  publishedAt?: string;
  publishedBy?: string;
  sourceUserId?: string;
  sourceRuleId?: string;
}

export interface IRuleBlueprintSummary {
  id: string;
  name: string;
  description?: string;
  color: RuleColor;
  tags: string[];
  applicableTo: RuleApplicability[];
  status: RuleBlueprintStatus;
  version: number;
  updatedAt: string;
}

export interface ICreateRuleBlueprintRequest {
  name: string;
  description?: string;
  content: string;
  color: RuleColor;
  tags: string[];
  applicableTo: RuleApplicability[];
}

export interface IUpdateRuleBlueprintRequest {
  name?: string;
  description?: string;
  content?: string;
  color?: RuleColor;
  tags?: string[];
  applicableTo?: RuleApplicability[];
}

const ruleColorSchema = z.enum([
  'red',
  'orange',
  'yellow',
  'green',
  'blue',
  'indigo',
  'purple',
  'pink',
  'gray',
]);

const ruleApplicabilitySchema = z.enum([
  'scraping',
  'upload',
  'prompt',
  'quiz',
  'followup',
  'chat',
  'flashcard',
  'flashcard_desc',
  'slide_deck',
  'diagram_quiz',
  'sequence_quiz',
]);

function isRuleColor(value: string): value is RuleColor {
  return ruleColorSchema.safeParse(value).success;
}

function isRuleApplicability(value: string): value is RuleApplicability {
  return ruleApplicabilitySchema.safeParse(value).success;
}

export const ruleBlueprintFormSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  description: z.string().trim().max(500).optional(),
  content: z.string().trim().min(1, 'Content is required').max(100_000),
  color: ruleColorSchema,
  tags: z.array(z.string().trim().min(1).max(50)).max(20),
  applicableTo: z
    .array(ruleApplicabilitySchema)
    .min(1, 'Select at least one applicability'),
});

export const updateRuleBlueprintFormSchema = ruleBlueprintFormSchema.partial();

export type IRuleBlueprintFormValues = z.infer<typeof ruleBlueprintFormSchema>;

function toCreateRuleBlueprintRequest(
  parsed: IRuleBlueprintFormValues,
): ICreateRuleBlueprintRequest {
  if (!isRuleColor(parsed.color)) {
    throw new Error('Invalid rule color.');
  }

  const applicableTo = parsed.applicableTo.filter(isRuleApplicability);
  if (applicableTo.length !== parsed.applicableTo.length) {
    throw new Error('Invalid rule applicability.');
  }

  return {
    name: parsed.name,
    description: parsed.description,
    content: parsed.content,
    color: parsed.color,
    tags: parsed.tags,
    applicableTo,
  };
}

export function parseRuleBlueprintForm(
  payload: unknown,
): ICreateRuleBlueprintRequest {
  const parsed = ruleBlueprintFormSchema.safeParse(payload);
  if (!parsed.success) {
    const message =
      parsed.error.issues[0]?.message ?? 'Invalid blueprint payload.';
    throw new Error(message);
  }
  return toCreateRuleBlueprintRequest(parsed.data);
}

export function parseUpdateRuleBlueprintForm(
  payload: unknown,
): IUpdateRuleBlueprintRequest {
  const parsed = updateRuleBlueprintFormSchema.safeParse(payload);
  if (!parsed.success) {
    const message =
      parsed.error.issues[0]?.message ?? 'Invalid blueprint payload.';
    throw new Error(message);
  }

  const update: IUpdateRuleBlueprintRequest = {};

  if (parsed.data.name !== undefined) {
    update.name = parsed.data.name;
  }
  if (parsed.data.description !== undefined) {
    update.description = parsed.data.description;
  }
  if (parsed.data.content !== undefined) {
    update.content = parsed.data.content;
  }
  if (parsed.data.color !== undefined) {
    if (!isRuleColor(parsed.data.color)) {
      throw new Error('Invalid rule color.');
    }
    update.color = parsed.data.color;
  }
  if (parsed.data.tags !== undefined) {
    update.tags = parsed.data.tags;
  }
  if (parsed.data.applicableTo !== undefined) {
    const applicableTo = parsed.data.applicableTo.filter(isRuleApplicability);
    if (applicableTo.length !== parsed.data.applicableTo.length) {
      throw new Error('Invalid rule applicability.');
    }
    update.applicableTo = applicableTo;
  }

  return update;
}

export interface ISearchRuleBlueprintsRequest {
  query?: string;
  applicableTo?: RuleApplicability;
  tags?: string[];
  limit?: number;
}

export interface ICreateRuleFromBlueprintRequest {
  blueprintId: string;
  name: string;
  content: string;
  description?: string;
  color?: RuleColor;
  tags?: string[];
  applicableTo?: RuleApplicability[];
  isDefault?: boolean;
  directoryId?: string;
}
