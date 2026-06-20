import { logger } from 'firebase-functions/v2';
import { InMemoryRunner } from '@google/adk';
import type { ArtifactAgentJobInput } from './artifact-agent-definition';
import { ArtifactAgentRegistry } from './artifact-agent-registry';
import {
  createArtifactPipeline,
  createInitialPipelineState,
  runArtifactPipelineOrchestration,
} from './artifact-agent-pipeline-factory';

/**
 * Runs the artifact agent pipeline for a queued generation job.
 * Uses direct orchestration (same steps as the ADK SequentialAgent/LoopAgent tree).
 */
export async function runArtifactAgentPipeline(input: ArtifactAgentJobInput): Promise<void> {
  const definition = ArtifactAgentRegistry.get(input.artifactKind);

  logger.info('Starting artifact agent pipeline', {
    artifactKind: input.artifactKind,
    userId: input.userId,
    recordId: input.recordId,
    jobId: input.jobId,
  });

  // Verify ADK pipeline can be constructed for this definition (orchestration parity check).
  createArtifactPipeline(definition as Parameters<typeof createArtifactPipeline>[0]);
  createInitialPipelineState(definition as Parameters<typeof createInitialPipelineState>[0]);
  new InMemoryRunner({
    agent: createArtifactPipeline(definition as Parameters<typeof createArtifactPipeline>[0]),
    appName: 'study-forge-artifact-agent',
  });

  await runArtifactPipelineOrchestration(
    definition as Parameters<typeof runArtifactPipelineOrchestration>[0],
    input
  );

  logger.info('Artifact agent pipeline completed', {
    artifactKind: input.artifactKind,
    userId: input.userId,
    recordId: input.recordId,
    jobId: input.jobId,
  });
}
