import { DocumentCrudService } from './document-crud';
import {
  failPendingFlashcardSet,
  failPendingQuiz,
  failPendingSequenceQuiz,
  failPendingSlideDeck,
  failPendingSubjectWorld,
} from './artifact-generation-records';
import { failPendingDiagramQuiz } from './artifact-generation-records';
import type { GenerationJob } from './generation-jobs';

export async function failVisibleGenerationRecord(job: GenerationJob, message: string): Promise<void> {
  switch (job.kind) {
    case 'documentFromPrompt':
    case 'documentFromScreenshot':
      await DocumentCrudService.failPendingDocument(job.userId, job.recordId, message);
      return;
    case 'artifactAgent':
      await failPendingDiagramQuiz(job.userId, job.recordId, message);
      return;
    case 'quiz':
      await failPendingQuiz(job.userId, job.recordId, message);
      return;
    case 'flashcards':
      await failPendingFlashcardSet(job.userId, job.recordId, message);
      return;
    case 'sequenceQuiz':
      await failPendingSequenceQuiz(job.userId, job.recordId, message);
      return;
    case 'slideDeck':
      await failPendingSlideDeck(job.userId, job.recordId, message);
      return;
    case 'subjectWorld':
      await failPendingSubjectWorld(job.userId, job.recordId, message);
      return;
    default:
      throw new Error(`Unsupported generation job kind: ${job.kind}`);
  }
}
