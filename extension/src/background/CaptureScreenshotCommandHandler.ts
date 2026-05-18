import { CaptureState, CAPTURE_SCREENSHOT_COMMAND } from '../types';
import { ExtensionSettingsRepository } from '../services/ExtensionSettingsRepository';
import { ExtensionSettingsValidator } from '../services/ExtensionSettingsValidator';
import { ScreenshotCaptureService } from '../services/ScreenshotCaptureService';
import { StudyForgeApiClient } from '../services/StudyForgeApiClient';
import { NotificationService } from '../services/NotificationService';

export interface CaptureScreenshotCommandHandlerDeps {
  settingsRepository: ExtensionSettingsRepository;
  settingsValidator: ExtensionSettingsValidator;
  screenshotCaptureService: ScreenshotCaptureService;
  studyForgeApiClient: StudyForgeApiClient;
  notificationService: NotificationService;
}

export class CaptureScreenshotCommandHandler {
  private state: CaptureState = 'idle';

  constructor(private readonly deps: CaptureScreenshotCommandHandlerDeps) {}

  async handle(command: string): Promise<void> {
    if (command !== CAPTURE_SCREENSHOT_COMMAND) {
      return;
    }

    if (this.state !== 'idle') {
      await this.showErrorSafely('A screenshot capture is already running.');
      return;
    }

    try {
      this.transitionTo('validating');
      const settings = await this.deps.settingsRepository.getSettings();
      const { directoryId } = this.deps.settingsValidator.validateForCommand(settings, command);

      this.transitionTo('capturing');
      await this.deps.notificationService.showProgress();
      const imageBase64 = await this.deps.screenshotCaptureService.captureVisibleViewport();

      this.transitionTo('uploading');
      const result = await this.deps.studyForgeApiClient.generateFromScreenshot({
        apiBaseUrl: settings.apiBaseUrl,
        apiKey: settings.apiKey,
        directoryId,
        imageBase64,
      });

      this.transitionTo('success');
      await this.deps.notificationService.showSuccess(
        result.title,
        `${settings.appBaseUrl.replace(/\/+$/, '')}/document/${result.documentId}`
      );
    } catch (error) {
      this.transitionTo('error');
      await this.showErrorSafely(
        error instanceof Error ? error.message : 'Screenshot capture failed.'
      );
    } finally {
      this.transitionTo('idle');
    }
  }

  private transitionTo(state: CaptureState): void {
    this.state = state;
  }

  private async showErrorSafely(message: string): Promise<void> {
    try {
      await this.deps.notificationService.showError(message);
    } catch (error) {
      console.warn('Failed to show StudyForge Capture error notification', error);
    }
  }
}