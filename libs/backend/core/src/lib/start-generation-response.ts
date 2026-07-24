import type { GenerationRecordType, StartGenerationResponse } from '@shared-types';

export function buildStartGenerationPayload<T extends Record<string, string> = Record<string, never>>(
  recordType: GenerationRecordType,
  recordId: string,
  directoryId: string,
  legacyFields: T
): StartGenerationResponse & T {
  return {
    success: true,
    id: recordId,
    recordType,
    directoryId,
    generationStatus: 'pending',
    ...legacyFields,
  } as StartGenerationResponse & T;
}
