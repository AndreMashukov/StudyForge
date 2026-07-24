export const DEFAULT_GEMINI_IMAGE_MODEL = 'gemini-3.1-flash-image-preview';
export const DEFAULT_OPENROUTER_IMAGE_MODEL = 'google/gemini-3.1-flash-image-preview';

/** Map an OpenRouter image model id to a Gemini SDK model id for direct fallback. */
export function toGeminiImageModel(openRouterModelId?: string): string {
  const model = openRouterModelId?.trim() || DEFAULT_GEMINI_IMAGE_MODEL;
  if (model.startsWith('google/')) {
    return model.slice('google/'.length);
  }
  return DEFAULT_GEMINI_IMAGE_MODEL;
}

/** Extract raw base64 from a data URL returned by OpenRouter image generation. */
export function extractBase64FromImageDataUrl(dataUrl: string): string | null {
  const match = dataUrl.match(/^data:image\/\w+;base64,(.+)$/);
  if (match) {
    return match[1];
  }

  const base64Index = dataUrl.indexOf('base64,');
  if (base64Index >= 0) {
    return dataUrl.slice(base64Index + 'base64,'.length);
  }

  return null;
}
