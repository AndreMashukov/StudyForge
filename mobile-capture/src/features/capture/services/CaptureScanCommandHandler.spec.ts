import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CaptureScanCommandHandler } from './CaptureScanCommandHandler';

const { scanDocument, recognizeText } = vi.hoisted(() => ({
  scanDocument: vi.fn(),
  recognizeText: vi.fn(),
}));

vi.mock('expo-document-scanner', () => ({ scanDocument }));
vi.mock('expo-ocr-kit', () => ({ recognizeText }));
vi.mock('../../../lib/api/studyforgeApi', () => ({
  getCallableErrorMessage: (error: unknown) =>
    error instanceof Error ? error.message : 'An unknown error occurred.',
}));

describe('CaptureScanCommandHandler', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it.each([
    'java.lang.Exception: User cancelled the scan (resultCode=0).',
    'User cancelled the scan.',
  ])('returns to idle without OCR when the scanner is cancelled: %s', async (message) => {
    scanDocument.mockRejectedValue(new Error(message));
    const handler = new CaptureScanCommandHandler();
    const states: string[] = [];
    handler.setOnStateChange((state) => states.push(state));

    await expect(handler.handle('directory')).resolves.toBeNull();
    expect(states).toEqual(['validating', 'capturing', 'idle']);
    expect(recognizeText).not.toHaveBeenCalled();
  });

  it('runs OCR for a successful scan', async () => {
    scanDocument.mockResolvedValue({ pages: [{ uri: 'file:///scan.jpg' }] });
    recognizeText.mockResolvedValue({ text: '  Recognized text  ' });

    await expect(new CaptureScanCommandHandler().handle('directory')).resolves.toEqual({
      imageUri: 'file:///scan.jpg',
      ocrText: 'Recognized text',
    });
  });

  it('continues to report scanner failures', async () => {
    scanDocument.mockRejectedValue(new Error('Camera unavailable'));
    const handler = new CaptureScanCommandHandler();

    await expect(handler.handle('directory')).rejects.toThrow('Camera unavailable');
    expect(handler.getState()).toBe('idle');
  });

  it('does not mistake OCR errors for scanner cancellation', async () => {
    scanDocument.mockResolvedValue({ pages: [{ uri: 'file:///scan.jpg' }] });
    recognizeText.mockRejectedValue(new Error('User cancelled the scan.'));

    await expect(new CaptureScanCommandHandler().handle('directory')).rejects.toThrow(
      'User cancelled the scan.',
    );
  });
});
