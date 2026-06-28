import { z } from 'zod';
import { DocumentSourceType, DocumentStatus } from '@shared-types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isFirestoreTimestamp(value: unknown): value is { toDate(): Date } {
  if (!isRecord(value)) {
    return false;
  }
  const toDate = Reflect.get(value, 'toDate');
  return typeof toDate === 'function';
}

function isSerializedFirestoreTimestamp(
  value: unknown
): value is { seconds: number; nanoseconds: number } {
  if (!isRecord(value)) {
    return false;
  }

  const seconds = value.seconds ?? value._seconds;
  const nanoseconds = value.nanoseconds ?? value._nanoseconds;
  return typeof seconds === 'number' && typeof nanoseconds === 'number';
}

/** Accepts Date, live Timestamp, or JSON-serialized Timestamp from Firebase callables. */
const firestoreDateSchema = z.custom<
  Date | { toDate(): Date } | { seconds: number; nanoseconds: number }
>((value) => {
  if (value instanceof Date) {
    return true;
  }
  if (isFirestoreTimestamp(value)) {
    return true;
  }
  if (isSerializedFirestoreTimestamp(value)) {
    return true;
  }
  if (typeof value === 'string' && !Number.isNaN(Date.parse(value))) {
    return true;
  }
  return false;
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
  createdAt: firestoreDateSchema,
  updatedAt: firestoreDateSchema,
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
  createdAt: firestoreDateSchema,
  updatedAt: firestoreDateSchema,
  generationStatus: z.enum(['pending', 'completed', 'failed']).optional(),
  generationError: z.string().optional(),
  completedAt: firestoreDateSchema.optional(),
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
  id: z.string().optional(),
  documentId: z.string(),
  recordType: z.literal('document').optional(),
  directoryId: z.string().optional(),
  generationStatus: z.enum(['pending', 'completed', 'failed']).optional(),
  title: z.string().optional(),
  content: z.string().optional(),
  wordCount: z.number().optional(),
  metadata: z
    .object({
      generatedAt: z.string().optional(),
      sourceType: z.literal('screenshot').optional(),
      directoryId: z.string().optional(),
      prompt: z.string().optional(),
    })
    .optional(),
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
