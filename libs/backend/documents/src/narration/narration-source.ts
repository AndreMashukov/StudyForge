import {
  buildNarrationScript,
  documentNarratabilitySchema,
  narrationScriptVersionFor,
  parseDocumentBlocks,
  planNarrationParts,
  type DocumentContentFormat,
  type DocumentNarratability,
  type INarrationPartPlan,
  type INarrationScript,
  type NarrationScriptVersion,
} from '@shared-types';
import { FirestorePaths } from '@study-forge/backend-core/lib/firestore-paths';
import { DocumentService } from '../document-storage';
import { narrationContentHash } from './narration-planning';
import { readNarrationRecord } from './narration-store';

/** Document fields narration reads from the record. */
export interface INarrationDocumentFields {
  title: string;
  status?: string;
  generationStatus?: string;
  contentFormat?: DocumentContentFormat;
  storagePath?: string;
  narratability?: DocumentNarratability;
}

export interface INarrationSource {
  document: INarrationDocumentFields;
  script: INarrationScript;
  plan: INarrationPartPlan[];
  contentHash: string;
}

function readString(
  data: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = data[key];
  return typeof value === 'string' ? value : undefined;
}

function readContentFormat(value: unknown): DocumentContentFormat | undefined {
  return value === 'html' || value === 'markdown' ? value : undefined;
}

export function readNarrationDocumentFields(
  data: Record<string, unknown>,
): INarrationDocumentFields {
  const narratability = documentNarratabilitySchema.safeParse(
    data.narratability,
  );
  return {
    title: readString(data, 'title') ?? '',
    status: readString(data, 'status'),
    generationStatus: readString(data, 'generationStatus'),
    contentFormat: readContentFormat(data.contentFormat),
    storagePath: readString(data, 'storagePath'),
    narratability: narratability.success ? narratability.data : undefined,
  };
}

/** A document whose body is final: not deleted, not pending, not failed. */
export function isDocumentReadyForNarration(
  document: INarrationDocumentFields,
): boolean {
  if (document.status === 'deleted') return false;
  return (
    document.generationStatus === undefined ||
    document.generationStatus === 'completed'
  );
}

export class NarrationDocumentNotFoundError extends Error {
  constructor(documentId: string) {
    super(`Document ${documentId} not found`);
    this.name = 'NarrationDocumentNotFoundError';
  }
}

/** The document record as stored. */
export async function readNarrationDocumentData(
  userId: string,
  documentId: string,
): Promise<Record<string, unknown>> {
  const snapshot = await FirestorePaths.document(userId, documentId).get();
  const data = snapshot.data();
  if (!snapshot.exists || !data) {
    throw new NarrationDocumentNotFoundError(documentId);
  }
  return data;
}

/** Reads the document record only. */
export async function readNarrationDocument(
  userId: string,
  documentId: string,
): Promise<INarrationDocumentFields> {
  return readNarrationDocumentFields(
    await readNarrationDocumentData(userId, documentId),
  );
}

/**
 * Builds the spoken text and part plan from a document's stored body, with the
 * spoken-text rules of its narration (ADR 020): a narration keeps the rules
 * it was made with, so pass the version when the record is already read.
 * Without one, the narration record is read to find it.
 */
export async function loadNarrationSource(
  userId: string,
  documentId: string,
  document?: INarrationDocumentFields,
  scriptVersion?: NarrationScriptVersion,
): Promise<INarrationSource> {
  const [fields, version] = await Promise.all([
    document ?? readNarrationDocument(userId, documentId),
    scriptVersion ??
      readNarrationRecord(userId, documentId).then(narrationScriptVersionFor),
  ]);
  const stored = await DocumentService.getDocumentContentWithFormat(
    userId,
    documentId,
    {
      storagePath: fields.storagePath,
      contentFormat: fields.contentFormat,
    },
  );
  const blocks = parseDocumentBlocks(stored.content, stored.contentFormat);
  const script = buildNarrationScript(fields.title, blocks, version);
  return {
    document: fields,
    script,
    plan: planNarrationParts(script),
    contentHash: narrationContentHash(script),
  };
}

/**
 * Document fields whose change can change the spoken text. The narratable
 * check's own `narratability` write is not among them, so it does not re-fire.
 */
const NARRATION_CONTENT_FIELDS = [
  'title',
  'status',
  'generationStatus',
  'contentFormat',
  'storagePath',
  'storageUrl',
  'wordCount',
  'updatedAt',
] as const;

function fieldValuesEqual(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (
    typeof left === 'object' &&
    left !== null &&
    'isEqual' in left &&
    typeof left.isEqual === 'function'
  ) {
    return Boolean(left.isEqual(right));
  }
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

export function narrationContentFieldsChanged(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): boolean {
  return NARRATION_CONTENT_FIELDS.some(
    (field) => !fieldValuesEqual(before[field], after[field]),
  );
}
