import { logger } from 'firebase-functions/v2';
import { DocumentSourceType } from '@shared-types';
import {
  claimSampleLibrary,
  recordSampleLibrary,
} from '@study-forge/backend-core/services/user-onboarding-service';
import { directoryService } from '@study-forge/backend-directories/directory';
import {
  completePendingQuiz,
  createPendingQuiz,
} from '@study-forge/backend-artifacts/artifact-generation-records';
import { DocumentCrudService } from '../document-crud';
import { prepareHtmlDocumentForStorage } from '../document-html';
import {
  SAMPLE_LIBRARY_DIRECTORY,
  SAMPLE_LIBRARY_DOCUMENTS,
  SAMPLE_LIBRARY_QUIZ,
  SAMPLE_LIBRARY_TAG,
} from './sample-library-content';

/**
 * Creates the sample folder for a new account: two ready-made documents and a
 * quiz, with no AI generation, so the library is never empty. Runs at most
 * once per account (the claim is transactional). Returns the folder id, or
 * undefined when it was already claimed.
 */
export async function ensureSampleLibrary(
  userId: string,
): Promise<string | undefined> {
  const claimed = await claimSampleLibrary(userId);
  if (!claimed) {
    return undefined;
  }

  const directory = await directoryService.createDirectory(userId, {
    name: SAMPLE_LIBRARY_DIRECTORY.name,
    description: SAMPLE_LIBRARY_DIRECTORY.description,
    parentId: null,
  });
  await recordSampleLibrary(userId, directory.id);

  const documents: Array<{ id: string; title: string; color?: string }> = [];
  for (const sample of SAMPLE_LIBRARY_DOCUMENTS) {
    const prepared = await prepareHtmlDocumentForStorage(
      sample.html,
      sample.title,
    );
    const document = await DocumentCrudService.createDocument(userId, {
      title: sample.title,
      description: sample.description,
      content: prepared.fullHtml,
      contentFormat: 'html',
      sourceType: DocumentSourceType.GENERATED,
      tags: [SAMPLE_LIBRARY_TAG],
      directoryId: directory.id,
    });
    documents.push({
      id: document.id,
      title: document.title,
      ...(document.color ? { color: document.color } : {}),
    });
  }

  const [first] = documents;
  if (first) {
    const colors = documents.flatMap((entry) =>
      entry.color ? [entry.color] : [],
    );
    const quizId = await createPendingQuiz({
      userId,
      directoryId: directory.id,
      documentId: first.id,
      documentIds: documents.map((entry) => entry.id),
      documentTitle: first.title,
      title: SAMPLE_LIBRARY_QUIZ.title,
      ...(first.color ? { documentColor: first.color } : {}),
      ...(colors.length > 0 ? { documentColors: colors } : {}),
    });
    await completePendingQuiz(userId, quizId, {
      title: SAMPLE_LIBRARY_QUIZ.title,
      questions: SAMPLE_LIBRARY_QUIZ.questions,
    });
  }

  logger.info('Sample library created', {
    userId,
    directoryId: directory.id,
    documentCount: documents.length,
  });
  return directory.id;
}
