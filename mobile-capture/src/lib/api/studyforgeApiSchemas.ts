import { z } from 'zod';
import { DocumentSourceType, DocumentStatus } from '@shared-types';

function isFirestoreTimestamp(value: unknown): value is { toDate(): Date } {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const toDate = Reflect.get(value, 'toDate');
  return typeof toDate === 'function';
}

const dateOrTimestampSchema = z.custom<Date | { toDate(): Date }>((value) => {
  return value instanceof Date || isFirestoreTimestamp(value);
});

const directorySchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string(),
  parentId: z.string().nullable(),
  path: z.string(),
  level: z.number(),
  color: z.string().optional(),
  icon: z.string().optional(),
  description: z.string().optional(),
  documentCount: z.number(),
  childCount: z.number(),
  quizCount: z.number(),
  flashcardSetCount: z.number(),
  slideDeckCount: z.number(),
  diagramQuizCount: z.number().optional(),
  sequenceQuizCount: z.number().optional(),
  subjectWorldCount: z.number().optional(),
  ruleIds: z.array(z.string()),
  createdAt: dateOrTimestampSchema,
  updatedAt: dateOrTimestampSchema,
});

interface IDirectoryTreeNodeSchema {
  directory: z.infer<typeof directorySchema>;
  children: IDirectoryTreeNodeSchema[];
  isExpanded?: boolean;
  isSelected?: boolean;
}

const directoryTreeNodeSchema: z.ZodType<IDirectoryTreeNodeSchema> = z.lazy(() =>
  z.object({
    directory: directorySchema,
    children: z.array(directoryTreeNodeSchema),
    isExpanded: z.boolean().optional(),
    isSelected: z.boolean().optional(),
  })
);

export const getDirectoryTreeResponseSchema = z.object({
  tree: z.array(directoryTreeNodeSchema),
  totalDirectories: z.number(),
});

const documentEnhancedSchema = z.object({
  id: z.string(),
  userId: z.string(),
  title: z.string(),
  description: z.string(),
  sourceType: z.nativeEnum(DocumentSourceType),
  sourceUrl: z.string().optional(),
  wordCount: z.number(),
  status: z.nativeEnum(DocumentStatus),
  storageUrl: z.string(),
  storagePath: z.string(),
  tags: z.array(z.string()),
  directoryId: z.string(),
  createdAt: dateOrTimestampSchema,
  updatedAt: dateOrTimestampSchema,
  generationStatus: z.enum(['pending', 'completed', 'failed']).optional(),
  generationError: z.string().optional(),
  completedAt: dateOrTimestampSchema.optional(),
  appliedRuleIds: z.array(z.string()).optional(),
  generationModel: z.string().optional(),
  color: z.string().optional(),
});

export const createDocumentResponseSchema = z.object({
  success: z.boolean(),
  document: documentEnhancedSchema,
});

export const generateFromScreenshotResponseSchema = z.object({
  success: z.boolean(),
  documentId: z.string(),
  title: z.string(),
  content: z.string(),
  wordCount: z.number(),
  metadata: z.object({
    generatedAt: z.string(),
    sourceType: z.literal('screenshot'),
    directoryId: z.string(),
    prompt: z.string().optional(),
  }),
});

export function parseCallableResponse<T>(schema: z.ZodType<T>, data: unknown): T {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    throw new Error(`Invalid callable response: ${parsed.error.message}`);
  }
  return parsed.data;
}

export type IGetDirectoryTreeResponse = z.infer<typeof getDirectoryTreeResponseSchema>;
export type ICreateDocumentResponse = z.infer<typeof createDocumentResponseSchema>;
export type IGenerateFromScreenshotResponse = z.infer<typeof generateFromScreenshotResponseSchema>;
