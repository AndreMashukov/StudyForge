export class DocumentAgentPipelineFailedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DocumentAgentPipelineFailedError';
  }
}
