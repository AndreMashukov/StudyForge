import { useCallback } from 'react';
import { z } from 'zod';

const createCreateSlideDeckPageSchema = () => z.object({
  documentIds: z
    .array(z.string())
    .min(1, "Please select at least one document"),
  slideDeckName: z
    .string()
    .max(100, "Slide deck name must be 100 characters or less")
    .refine(
      (value) => !value || value.trim().length > 0,
      "Slide deck name cannot be only whitespace"
    )
    .optional(),
  additionalPrompt: z
    .string()
    .max(500, "Additional prompt must be 500 characters or less")
    .refine(
      (value) => !value || value.trim().length > 0,
      "Additional prompt cannot be only whitespace"
    )
    .optional(),
  ruleIds: z.array(z.string()).optional(),
});

export const useCreateSlideDeckPageSchema = () => {
  const schema = useCallback(() => createCreateSlideDeckPageSchema(), []);

  return { schema: schema() };
};
