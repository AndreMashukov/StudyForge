import { useCallback } from 'react';
import { z } from 'zod';

const createCreateQuizPageSchema = () => z.object({
  documentId: z
    .string()
    .min(1, "Please select a document"),
  quizName: z
    .string()
    .max(100, "Quiz name must be 100 characters or less")
    .refine(
      (value) => !value || value.trim().length > 0,
      "Quiz name cannot be only whitespace"
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
});

export type CreateQuizPageFormData = z.infer<ReturnType<typeof createCreateQuizPageSchema>>;

export const useCreateQuizPageSchema = () => {
  const schema = useCallback(() => createCreateQuizPageSchema(), []);
  
  return {
    schema: schema(),
    type: {} as CreateQuizPageFormData, // For type inference
  };
};