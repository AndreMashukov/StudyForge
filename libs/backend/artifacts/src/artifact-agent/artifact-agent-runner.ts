import { logger } from 'firebase-functions/v2';
import { InMemoryRunner } from '@google/adk';
import type { ArtifactAgentJobInput } from './artifact-agent-definition';
import { ArtifactAgentRegistry } from './artifact-agent-registry';
import { ArtifactAgentPipelineFailedError } from './artifact-agent-errors';
import {
  createArtifactPipeline,
  createInitialSessionState,
  readPipelineFailureMessage,
  readPipelineOutcome,
} from './artifact-agent-pipeline-factory';

const ARTIFACT_AGENT_APP_NAME = 'study-forge-artifact-agent';

/**
 * Runs the artifact agent pipeline for a queued generation job via ADK Runner.
 */
export async function runArtifactAgentPipeline(input: ArtifactAgentJobInput): Promise<void> {
  const definition = ArtifactAgentRegistry.get(input.artifactKind);

  logger.info('Starting artifact agent pipeline', {
    artifactKind: input.artifactKind,
    userId: input.userId,
    recordId: input.recordId,
    jobId: input.jobId,
    orchestrationMode: 'adk-runner',
  });

  const pipeline = createArtifactPipeline(
    definition as Parameters<typeof createArtifactPipeline>[0]
  );
  const runner = new InMemoryRunner({
    agent: pipeline,
    appName: ARTIFACT_AGENT_APP_NAME,
  });

  await runner.sessionService.createSession({
    appName: ARTIFACT_AGENT_APP_NAME,
    userId: input.userId,
    sessionId: input.jobId,
    state: createInitialSessionState(
      definition as Parameters<typeof createInitialSessionState>[0],
      input
    ),
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- ADK requires consuming the async event stream
  for await (const _event of runner.runAsync({
    userId: input.userId,
    sessionId: input.jobId,
    newMessage: { parts: [{ text: 'Run artifact generation job' }] },
  })) {
    // Pipeline side effects are persisted by FinalizeAgent; consume the event stream to completion.
  }

  const finalSession = await runner.sessionService.getSession({
    appName: ARTIFACT_AGENT_APP_NAME,
    userId: input.userId,
    sessionId: input.jobId,
  });

  if (!finalSession) {
    throw new Error(`Artifact agent session ${input.jobId} not found after pipeline run`);
  }

  const outcome = readPipelineOutcome(finalSession.state);
  if (outcome === 'failed') {
    const message = readPipelineFailureMessage(finalSession.state);
    logger.warn('Artifact agent pipeline failed verification', {
      artifactKind: input.artifactKind,
      userId: input.userId,
      recordId: input.recordId,
      jobId: input.jobId,
      message,
      orchestrationMode: 'adk-runner',
    });
    throw new ArtifactAgentPipelineFailedError(message);
  }

  if (outcome !== 'completed') {
    throw new Error(
      `Artifact agent pipeline finished without a terminal outcome (jobId=${input.jobId})`
    );
  }

  logger.info('Artifact agent pipeline completed', {
    artifactKind: input.artifactKind,
    userId: input.userId,
    recordId: input.recordId,
    jobId: input.jobId,
    orchestrationMode: 'adk-runner',
  });
}
