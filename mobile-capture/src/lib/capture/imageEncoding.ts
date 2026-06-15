import * as ImageManipulator from 'expo-image-manipulator';

const MAX_BASE64_LENGTH = 14_000_000;
const MAX_IMAGE_WIDTH = 1920;
const JPEG_QUALITY = 0.72;

export async function prepareImageBase64DataUrl(localUri: string): Promise<string> {
  const manipulated = await ImageManipulator.manipulateAsync(
    localUri,
    [{ resize: { width: MAX_IMAGE_WIDTH } }],
    { compress: JPEG_QUALITY, format: ImageManipulator.SaveFormat.JPEG, base64: true }
  );

  if (!manipulated.base64) {
    throw new Error('Failed to encode captured image.');
  }

  const dataUrl = `data:image/jpeg;base64,${manipulated.base64}`;

  if (dataUrl.length > MAX_BASE64_LENGTH) {
    throw new Error('Captured image is too large. Try moving closer or reducing resolution.');
  }

  return dataUrl;
}

export function deriveTitleFromContent(content: string, fallback = 'Captured Document'): string {
  const firstLine = content.split('\n').find((line) => line.trim().length > 0)?.trim();
  if (!firstLine) {
    return fallback;
  }
  return firstLine.length > 80 ? `${firstLine.slice(0, 80)}…` : firstLine;
}
