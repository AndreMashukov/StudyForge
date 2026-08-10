import type { LlmGenerationProfileId } from '@shared-types';
import type { LlmCapability } from './types';

const CAPABILITY_PROFILE_MAP: Partial<Record<LlmCapability, LlmGenerationProfileId>> =
  {
    quiz: 'structuredArtifact',
    sequenceQuiz: 'structuredArtifact',
    diagramQuiz: 'structuredArtifact',
    flashcards: 'structuredArtifact',
    documentFromPrompt: 'longformContent',
    documentFromScreenshot: 'longformContent',
    slideDeckText: 'longformContent',
    quizFollowup: 'explanatoryChat',
    documentQuestion: 'explanatoryChat',
    directoryChat: 'explanatoryChat',
    documentRevise: 'faithfulEdit',
    ruleGeneration: 'faithfulEdit',
    sourceDocumentEnhancement: 'deterministicUtility',
    diagramQuizAgent: 'deterministicUtility',
  };

export function resolveLlmGenerationProfile(
  capability: LlmCapability,
): LlmGenerationProfileId | undefined {
  return CAPABILITY_PROFILE_MAP[capability];
}
