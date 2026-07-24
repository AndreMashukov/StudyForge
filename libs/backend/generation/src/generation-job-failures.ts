import { DocumentCrudService } from '@study-forge/backend-documents/document-crud';
import {
  failPendingFlashcardSet,
  failPendingQuiz,
  failPendingSequenceQuiz,
  failPendingSlideDeck,
  failPendingSubjectWorld,
  failPendingDiagramQuiz,
} from '@study-forge/backend-artifacts/artifact-generation-records';
import type { GenerationJob } from './generation-jobs';
import { GenerationJobPayloadStorage } from './generation-job-payload-storage';
import type { ArtifactAgentJobPayload } from '@study-forge/backend-artifacts/artifact-agent';
import { isArtifactKind } from '@study-forge/backend-artifacts/artifact-agent/artifact-agent-record-paths';

async function resolveArtifactKind(job: GenerationJob): Promise<import('@shared-types').ArtifactKind> {
  if (job.artifactKind && isArtifactKind(job.artifactKind)) {
    return job.artifactKind;
  }

  try {
    const payload = await GenerationJobPayloadStorage.readJson<ArtifactAgentJobPayload>(
      job.payloadStoragePath
    );
    if (isArtifactKind(payload.artifactKind)) {
      return payload.artifactKind;
    }
  } catch {
    // Fall through to diagramQuiz for legacy jobs that predate artifactKind.
  }

  return 'diagramQuiz';
}

export async function failVisibleGenerationRecord(job: GenerationJob, message: string): Promise<void> {
  switch (job.kind) {
    case 'documentFromPrompt':
    case 'documentFromScreenshot':
      await DocumentCrudService.failPendingDocument(job.userId, job.recordId, message);
      return;
    case 'artifactAgent': {
      const artifactKind = await resolveArtifactKind(job);
      if (artifactKind === 'flashcards') {
        await failPendingFlashcardSet(job.userId, job.recordId, message);
        return;
      }
      if (artifactKind === 'diagramQuiz') {
        await failPendingDiagramQuiz(job.userId, job.recordId, message);
        return;
      }
      throw new Error(`Unsupported artifactAgent kind for failure handling: ${artifactKind}`);
    }
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
