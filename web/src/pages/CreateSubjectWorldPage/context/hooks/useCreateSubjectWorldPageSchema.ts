import { z } from 'zod';

export const createSubjectWorldPageSchema = z.object({
  documentIds: z.array(z.string()).min(1, 'Select at least one document'),
  subjectWorldName: z.string().optional(),
  additionalPrompt: z.string().optional(),
  ruleIds: z.array(z.string()).optional(),
  followupRuleIds: z.array(z.string()).optional(),
});
