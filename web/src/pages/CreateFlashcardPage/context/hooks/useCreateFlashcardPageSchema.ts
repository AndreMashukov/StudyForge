import { useCallback } from 'react';
import { z } from 'zod';

const createCreateFlashcardPageSchema = () => z.object({
  documentId: z
    .string()
    .min(1, "Please select a document"),
  flashcardName: z
    .string()
    .max(100, "Flashcard set name must be 100 characters or less")
    .refine(
      (value) => !value || value.trim().length > 0,
      "Flashcard set name cannot be only whitespace"
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

export type CreateFlashcardPageFormData = z.infer<ReturnType<typeof createCreateFlashcardPageSchema>>;

export const useCreateFlashcardPageSchema = () => {
  const schema = useCallback(() => createCreateFlashcardPageSchema(), []);
  
  return {
    schema: schema(),
    type: {} as CreateFlashcardPageFormData,
  };
};
