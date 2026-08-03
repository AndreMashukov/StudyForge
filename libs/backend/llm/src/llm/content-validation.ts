import * as functions from 'firebase-functions';

export interface IArtifactSourceContent {
  title: string;
  content: string;
  wordCount: number;
}

/**
 * Pre-flight validation for artifact generation from scraped document content.
 * Provider-neutral: does not call any LLM.
 */
export function validateContentForArtifactGeneration(
  content: IArtifactSourceContent,
): void {
  if (!content.title || content.title.trim().length === 0) {
    throw new Error('Content must have a title');
  }

  if (!content.content || content.content.trim().length === 0) {
    throw new Error('Content cannot be empty');
  }

  if (content.wordCount < 50) {
    throw new Error(
      'Content is too short for quiz generation (minimum 50 words required)',
    );
  }

  if (content.wordCount > 10000) {
    functions.logger.warn(
      `Content is very long (${content.wordCount} words), quiz generation may take longer`,
    );
  }

  if (
    content.content.includes('```') ||
    content.content.includes('{') ||
    content.content.includes('}')
  ) {
    functions.logger.info(
      'Content contains code-like patterns, will sanitize during generation',
    );
  }
}

/** @deprecated Use validateContentForArtifactGeneration. Pre-flight validation alias. */
export const validateContentForQuiz = validateContentForArtifactGeneration;
