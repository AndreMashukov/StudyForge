import { GenerationJobKind } from './generation-jobs';
import { GenerationJobPayloadStorage } from './generation-job-payload-storage';
import { GenerationJobsService } from './generation-jobs';
import { enqueueGenerationJobTask } from './generation-task-queue';

export interface EnqueueGenerationJobParams {
  userId: string;
  directoryId: string;
  recordId: string;
  kind: GenerationJobKind;
  payload: unknown;
}

export async function enqueueGenerationJob(params: EnqueueGenerationJobParams): Promise<string> {
  const jobId = GenerationJobsService.newJobId(params.userId);
  const payloadStoragePath = await GenerationJobPayloadStorage.saveJson(
    params.userId,
    jobId,
    params.payload
  );

  await GenerationJobsService.createJob({
    jobId,
    kind: params.kind,
    userId: params.userId,
    directoryId: params.directoryId,
    recordId: params.recordId,
    payloadStoragePath,
  });

  await enqueueGenerationJobTask({ userId: params.userId, jobId });
  return jobId;
}
