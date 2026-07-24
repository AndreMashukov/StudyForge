import { logger } from 'firebase-functions/v2';
import { DocumentService } from '@study-forge/backend-documents/document-storage';

export class GenerationJobPayloadStorage {
  static async saveJson<T>(userId: string, jobId: string, payload: T): Promise<string> {
    const bucket = DocumentService.getBucket();
    const storagePath = `users/${userId}/generation-jobs/${jobId}/payload.json`;
    const file = bucket.file(storagePath);

    await file.save(Buffer.from(JSON.stringify(payload), 'utf8'), {
      metadata: {
        contentType: 'application/json; charset=utf-8',
        cacheControl: 'private, max-age=0',
        customMetadata: {
          jobId,
          userId,
        },
      },
      resumable: false,
      validation: 'crc32c',
    });

    logger.info('Generation job payload stored', { userId, jobId, storagePath });
    return storagePath;
  }

  static async readJson<T>(storagePath: string): Promise<T> {
    const bucket = DocumentService.getBucket();
    const [buffer] = await bucket.file(storagePath).download();
    return JSON.parse(buffer.toString('utf8')) as T;
  }

  static async delete(storagePath: string): Promise<void> {
    const bucket = DocumentService.getBucket();
    await bucket.file(storagePath).delete({ ignoreNotFound: true });
  }
}