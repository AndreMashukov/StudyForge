import { z } from 'zod';
import {
  AI_REVISION_EXISTING_CONTENT_MAX,
  AI_REVISION_INSTRUCTION_MAX,
} from '@shared-types';

export { AI_REVISION_EXISTING_CONTENT_MAX, AI_REVISION_INSTRUCTION_MAX };

export const aiRevisionInstructionSchema = z
  .string()
  .min(1, 'Instruction is required')
  .max(
    AI_REVISION_INSTRUCTION_MAX,
    `Instruction must be ${AI_REVISION_INSTRUCTION_MAX.toLocaleString()} characters or less`
  );

export const aiRevisionExistingContentSchema = z
  .string()
  .max(
    AI_REVISION_EXISTING_CONTENT_MAX,
    `Content must be ${AI_REVISION_EXISTING_CONTENT_MAX.toLocaleString()} characters or less`
  );

export const reviseDocumentWithAIRequestSchema = z.object({
  documentId: z.string().min(1, 'Document ID is required'),
  instruction: aiRevisionInstructionSchema,
});
