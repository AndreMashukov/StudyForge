import { LlmRouteResolver } from './llm-route-resolver';
import { LlmVisionRouteResolver } from './llm-vision-route-resolver';
import { LlmImageRouteResolver } from './llm-image-route-resolver';
import type { LlmCapability, ResolvedRoute } from './types';

function formatGenerationModelLabel(route: ResolvedRoute): string {
  const provider =
    route.providerType === 'openrouter'
      ? 'OpenRouter'
      : route.providerType === 'minimax'
        ? 'MiniMax'
        : 'Gemini';
  return `${provider}: ${route.model}`;
}

export async function resolveTextGenerationModelLabel(
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
  >
): Promise<string> {
  const { route } = await LlmRouteResolver.resolve(capability);
  return formatGenerationModelLabel(route);
}

export async function resolveScreenshotGenerationModelLabel(): Promise<string> {
  const { route } = await LlmVisionRouteResolver.resolve('documentFromScreenshot');
  return formatGenerationModelLabel(route);
}

export async function resolveSlideDeckGenerationModelLabel(): Promise<string> {
  const [textResolution, imageResolution] = await Promise.all([
    LlmRouteResolver.resolve('slideDeckText'),
    LlmImageRouteResolver.resolve('slideDeckImage'),
  ]);

  const textLabel = formatGenerationModelLabel(textResolution.route);
  const imageModel =
    imageResolution.route.providerType !== 'gemini' && imageResolution.providerApiKey
      ? imageResolution.route.model
      : imageResolution.geminiImageModel;
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
