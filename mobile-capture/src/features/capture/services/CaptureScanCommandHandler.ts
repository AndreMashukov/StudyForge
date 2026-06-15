import { getCallableErrorMessage } from '../../../lib/api/studyforgeApi';
import { CaptureState } from '../types/ICapture';

export interface IScanPipelineResult {
  imageUri: string;
  ocrText: string;
}

const DEV_BUILD_REQUIRED_MESSAGE =
  'Document scanning requires a development build (not Expo Go). Run: yarn nx run mobile-capture:android';

async function loadScanNativeModules() {
  try {
    const [documentScanner, ocrKit] = await Promise.all([
      import('expo-document-scanner'),
      import('expo-ocr-kit'),
    ]);
    return {
      scanDocument: documentScanner.scanDocument,
      recognizeText: ocrKit.recognizeText,
    };
  } catch {
    throw new Error(DEV_BUILD_REQUIRED_MESSAGE);
  }
}

export class CaptureScanCommandHandler {
  private state: CaptureState = 'idle';
  private onStateChange?: (state: CaptureState) => void;

  setOnStateChange(listener: (state: CaptureState) => void): void {
    this.onStateChange = listener;
  }

  getState(): CaptureState {
    return this.state;
  }

  async handle(directoryId: string): Promise<IScanPipelineResult> {
    if (this.state !== 'idle') {
      throw new Error('Another capture is already in progress.');
    }

    try {
      this.transitionTo('validating');

      if (!directoryId.trim()) {
        throw new Error('Default directory is required. Choose one in Settings.');
      }

      const { scanDocument, recognizeText } = await loadScanNativeModules();

      this.transitionTo('capturing');
      const scanResult = await scanDocument({
        maxNumDocuments: 1,
        quality: 0.85,
      });

      const firstPage = scanResult.pages[0];
      if (!firstPage?.uri) {
        throw new Error('Document scan was cancelled or returned no pages.');
      }

      this.transitionTo('ocr');
      const ocrResult = await recognizeText(firstPage.uri);

      this.transitionTo('success');
      return {
        imageUri: firstPage.uri,
        ocrText: ocrResult.text.trim(),
      };
    } catch (error) {
      this.transitionTo('error');
      if (error instanceof Error && error.message === DEV_BUILD_REQUIRED_MESSAGE) {
        throw error;
      }
      throw new Error(getCallableErrorMessage(error));
    } finally {
      this.transitionTo('idle');
    }
  }

  private transitionTo(state: CaptureState): void {
    this.state = state;
    this.onStateChange?.(state);
  }
}
