import { z } from 'zod';

export const reviewDocumentSchema = z.object({
  title: z.string().trim().min(1, 'Title is required.'),
  content: z.string().trim().min(1, 'Document content is required.'),
});

export type IReviewDocumentFormValues = z.infer<typeof reviewDocumentSchema>;
