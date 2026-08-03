import { z } from 'zod';

const documentIdsSchema = z
  .array(z.string())
  .min(1, 'Please select at least one document')
  .max(5, 'Maximum 5 documents allowed');

const optionalNameSchema = z
  .string()
  .max(100, 'Name must be 100 characters or less')
  .refine((value) => !value || value.trim().length > 0, 'Name cannot be only whitespace');

const optionalPromptSchema = z
  .string()
  .max(20000, 'Additional prompt must be 20,000 characters or less')
  .refine(
    (value) => !value || value.trim().length > 0,
    'Additional prompt cannot be only whitespace',
  );

export const createArtifactFormSchema = z.object({
  documentIds: documentIdsSchema,
  name: optionalNameSchema.optional(),
  additionalPrompt: optionalPromptSchema.optional(),
  ruleIds: z.array(z.string()).optional(),
  followupRuleIds: z.array(z.string()).optional(),
  descriptionRuleIds: z.array(z.string()).optional(),
});

export type CreateArtifactFormSchema = z.infer<typeof createArtifactFormSchema>;
