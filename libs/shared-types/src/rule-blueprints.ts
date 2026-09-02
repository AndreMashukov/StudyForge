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

export type ICreateRuleBlueprintRequest = z.infer<typeof ruleBlueprintFormSchema>;
export type IUpdateRuleBlueprintRequest = z.infer<
  typeof updateRuleBlueprintFormSchema
>;

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
