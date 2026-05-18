import { CaptureState, CAPTURE_SCREENSHOT_COMMAND } from '../types';
import { ExtensionSettingsRepository } from '../services/ExtensionSettingsRepository';
import { ExtensionSettingsValidator } from '../services/ExtensionSettingsValidator';
import { ScreenshotCaptureService } from '../services/ScreenshotCaptureService';
import { StudyForgeApiClient } from '../services/StudyForgeApiClient';
import { NotificationService } from '../services/NotificationService';
import { DebugLogService } from '../services/DebugLogService';

export interface CaptureScreenshotCommandHandlerDeps {
  settingsRepository: ExtensionSettingsRepository;
  settingsValidator: ExtensionSettingsValidator;
  screenshotCaptureService: ScreenshotCaptureService;
  studyForgeApiClient: StudyForgeApiClient;
  notificationService: NotificationService;
  debugLogService: DebugLogService;
}

export class CaptureScreenshotCommandHandler {
  private state: CaptureState = 'idle';

  constructor(private readonly deps: CaptureScreenshotCommandHandlerDeps) {}

  async handle(command: string): Promise<void> {
    await this.deps.debugLogService.info('Command received', {
      command,
      state: this.state,
    });

    if (command !== CAPTURE_SCREENSHOT_COMMAND) {
      await this.deps.debugLogService.info('Ignoring unsupported command', { command });
      return;
    }

    if (this.state !== 'idle') {
      await this.deps.debugLogService.info('Capture skipped because another capture is running', {
        state: this.state,
      });
      await this.showErrorSafely('A screenshot capture is already running.');
      return;
    }

    try {
      this.transitionTo('validating');
      const settings = await this.deps.settingsRepository.getSettings();
      const { directoryId } = this.deps.settingsValidator.validateForCommand(settings, command);
      await this.deps.debugLogService.info('Settings validated', {
        apiBaseUrl: settings.apiBaseUrl,
        appBaseUrl: settings.appBaseUrl,
        hasApiKey: Boolean(settings.apiKey.trim()),
        directoryId,
      });

      this.transitionTo('capturing');
      void this.showProgressSafely();
      await this.deps.debugLogService.info('Capturing visible viewport');
      const imageBase64 = await this.deps.screenshotCaptureService.captureVisibleViewport();
      await this.deps.debugLogService.info('Visible viewport captured', {
        imageBase64Length: imageBase64.length,
      });

      this.transitionTo('uploading');
      const result = await this.deps.studyForgeApiClient.generateFromScreenshot({
        apiBaseUrl: settings.apiBaseUrl,
        apiKey: settings.apiKey,
        directoryId,
        imageBase64,
      });

      this.transitionTo('success');
      await this.deps.debugLogService.info('Screenshot document created', {
        documentId: result.documentId,
        title: result.title,
      });
      await this.showSuccessSafely(
        result.title,
        `${settings.appBaseUrl.replace(/\/+$/, '')}/document/${result.documentId}`
      );
    } catch (error) {
      this.transitionTo('error');
      await this.deps.debugLogService.error('Screenshot capture failed', error);
      await this.showErrorSafely(
        error instanceof Error ? error.message : 'Screenshot capture failed.'
      );
    } finally {
      this.transitionTo('idle');
    }
  }

  private transitionTo(state: CaptureState): void {
    this.state = state;
    void this.deps.debugLogService.info('Capture state changed', { state });
  }

  private async showErrorSafely(message: string): Promise<void> {
    try {
      await this.deps.notificationService.showError(message);
    } catch (error) {
      console.warn('Failed to show StudyForge Capture error notification', error);
    }
  }

  private async showProgressSafely(): Promise<void> {
    try {
      await this.deps.notificationService.showProgress();
    } catch (error) {
      console.warn('Failed to show StudyForge Capture progress notification', error);
    }
  }

  private async showSuccessSafely(title: string, documentUrl: string): Promise<void> {
    try {
      await this.deps.notificationService.showSuccess(title, documentUrl);
    } catch (error) {
      console.warn('Failed to show StudyForge Capture success notification', error);
    }
  }
}