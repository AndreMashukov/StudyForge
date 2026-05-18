import { CaptureState, isCaptureCommand } from '../types';
import { ExtensionSettingsRepository } from '../services/ExtensionSettingsRepository';
import { ExtensionSettingsValidator } from '../services/ExtensionSettingsValidator';
import { ScreenshotCaptureService } from '../services/ScreenshotCaptureService';
import { StudyForgeApiClient } from '../services/StudyForgeApiClient';
import { DebugLogService } from '../services/DebugLogService';

export interface CaptureScreenshotCommandHandlerDeps {
  settingsRepository: ExtensionSettingsRepository;
  settingsValidator: ExtensionSettingsValidator;
  screenshotCaptureService: ScreenshotCaptureService;
  studyForgeApiClient: StudyForgeApiClient;
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

    if (!isCaptureCommand(command)) {
      await this.deps.debugLogService.info('Ignoring unsupported command', { command });
      return;
    }

    if (this.state !== 'idle') {
      await this.deps.debugLogService.info('Capture skipped because another capture is running', {
        state: this.state,
      });
      return;
    }

    try {
      this.transitionTo('validating');
      const settings = await this.deps.settingsRepository.getSettings();
      const { directoryId } = this.deps.settingsValidator.validateForCommand(settings, command);
      await this.deps.debugLogService.info('Settings validated', {
        command,
        apiBaseUrl: settings.apiBaseUrl,
        appBaseUrl: settings.appBaseUrl,
        hasApiKey: Boolean(settings.apiKey.trim()),
        directoryId,
      });

      this.transitionTo('capturing');
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
        command,
        documentId: result.documentId,
        title: result.title,
      });
    } catch (error) {
      this.transitionTo('error');
      await this.deps.debugLogService.error('Screenshot capture failed', error);
    } finally {
      this.transitionTo('idle');
    }
  }

  private transitionTo(state: CaptureState): void {
    this.state = state;
    void this.deps.debugLogService.info('Capture state changed', { state });
  }
}