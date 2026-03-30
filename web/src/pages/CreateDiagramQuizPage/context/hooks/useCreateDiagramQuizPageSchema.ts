import { useCallback } from 'react';
import { z } from 'zod';

const createSchema = () =>
  z.object({
    documentIds: z.array(z.string()).min(1, 'Please select at least one document'),
    diagramQuizName: z
      .string()
      .max(100, 'Name must be 100 characters or less')
      .refine((v) => !v || v.trim().length > 0, 'Name cannot be only whitespace')
      .optional(),
    additionalPrompt: z
      .string()
      .max(500, 'Additional prompt must be 500 characters or less')
      .refine((v) => !v || v.trim().length > 0, 'Additional prompt cannot be only whitespace')
      .optional(),
    ruleIds: z.array(z.string()).optional(),
  });

export type CreateDiagramQuizPageFormData = z.infer<ReturnType<typeof createSchema>>;

export const useCreateDiagramQuizPageSchema = () => {
  const schema = useCallback(() => createSchema(), []);
  return { schema: schema() };
};
