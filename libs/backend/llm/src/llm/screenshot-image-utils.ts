export interface NormalizedScreenshotImage {
  mimeType: string;
  /** Raw base64 without data-URL prefix */
  dataUrl: string;
  normalizedBase64: string;
}

const SUPPORTED_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

/**
 * Validate and normalize screenshot base64 input for vision providers.
 */
export function normalizeScreenshotImage(imageBase64: string): NormalizedScreenshotImage {
  let mimeType = 'image/png';
  let rawBase64 = imageBase64;
  const dataUrlMatch = imageBase64.match(/^data:(image\/\w+);base64,(.+)$/);
  if (dataUrlMatch) {
    mimeType = dataUrlMatch[1];
    rawBase64 = dataUrlMatch[2];
  }

  if (!SUPPORTED_MIME_TYPES.has(mimeType)) {
    throw new Error(`Unsupported screenshot MIME type: ${mimeType}`);
  }

  const normalizedBase64 = rawBase64.replace(/\s/g, '');
  if (
    normalizedBase64.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(normalizedBase64)
  ) {
    throw new Error('Screenshot image data is not valid base64');
  }

  const decodedImage = Buffer.from(normalizedBase64, 'base64');
  if (decodedImage.length === 0) {
    throw new Error('Screenshot image data is empty');
  }

  return {
    mimeType,
    normalizedBase64,
    dataUrl: `data:${mimeType};base64,${normalizedBase64}`,
  };
}
