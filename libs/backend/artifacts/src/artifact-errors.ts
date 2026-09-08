export class ArtifactAgentPipelineFailedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ArtifactAgentPipelineFailedError';
  }
}
