import { LlmGenerationRouteResolver } from './llm-generation-route-resolver';
import { formatGenerationModelLabel, toGenerationModelUsage } from './generation-model-usage';
import type { IGenerationModelUsage } from '@shared-types';
import type { LlmCapability } from './types';

export async function resolveTextGenerationModelLabel(
  userId: string,
  capability: Extract<
    LlmCapability,
    | 'quiz'
    | 'flashcards'
    | 'documentFromPrompt'
    | 'diagramQuiz'
    | 'diagramQuizAgent'
    | 'sequenceQuiz'
    | 'subjectWorld'
    | 'slideDeckText'
    | 'sourceDocumentEnhancement'
    | 'quizFollowup'
    | 'documentQuestion'
    | 'directoryChat'
    | 'ruleGeneration'
  >
): Promise<string> {
  const resolution = await LlmGenerationRouteResolver.resolve(capability, { userId });
  return formatGenerationModelLabel(resolution.route);
}

export async function resolveScreenshotGenerationModelLabel(userId: string): Promise<string> {
  const resolution = await LlmGenerationRouteResolver.resolve('documentFromScreenshot', {
    userId,
  });
  return formatGenerationModelLabel(resolution.route);
}

export async function resolveSlideDeckGenerationModelLabel(userId: string): Promise<string> {
  const [textResolution, imageResolution] = await Promise.all([
    LlmGenerationRouteResolver.resolve('slideDeckText', { userId }),
    LlmGenerationRouteResolver.resolve('slideDeckImage', { userId }),
  ]);

  const textLabel = formatGenerationModelLabel(textResolution.route);
  const imageModel =
    imageResolution.route.providerType !== 'gemini' && imageResolution.providerApiKey
      ? imageResolution.route.model
      : imageResolution.route.model;
  const imageLabel = formatGenerationModelLabel({
    ...imageResolution.route,
    providerType:
      imageResolution.route.providerType === 'gemini'
        ? 'gemini'
        : imageResolution.route.providerType,
    model: imageModel,
  });

  return textLabel === imageLabel ? textLabel : `${textLabel}, ${imageLabel}`;
}

export async function resolveSlideDeckGenerationAudit(
  userId: string
): Promise<{ generationModel: string; generationModelUsage: IGenerationModelUsage[] }> {
  const [textResolution, imageResolution] = await Promise.all([
    LlmGenerationRouteResolver.resolve('slideDeckText', { userId }),
    LlmGenerationRouteResolver.resolve('slideDeckImage', { userId }),
  ]);

  return {
    generationModel: await resolveSlideDeckGenerationModelLabel(userId),
    generationModelUsage: [
      toGenerationModelUsage(textResolution),
      toGenerationModelUsage(imageResolution),
    ],
  };
}
