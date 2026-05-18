import { CaptureScreenshotCommandHandler } from './CaptureScreenshotCommandHandler';
import { ExtensionSettingsRepository } from '../services/ExtensionSettingsRepository';
import { ExtensionSettingsValidator } from '../services/ExtensionSettingsValidator';
import { ScreenshotCaptureService } from '../services/ScreenshotCaptureService';
import { StudyForgeApiClient } from '../services/StudyForgeApiClient';
import { DebugLogService } from '../services/DebugLogService';

const debugLogService = new DebugLogService();
void debugLogService.info('Background service worker loaded');

const handler = new CaptureScreenshotCommandHandler({
  settingsRepository: new ExtensionSettingsRepository(),
  settingsValidator: new ExtensionSettingsValidator(),
  screenshotCaptureService: new ScreenshotCaptureService(),
  studyForgeApiClient: new StudyForgeApiClient(debugLogService),
  debugLogService,
});

chrome.commands.onCommand.addListener((command) => {
  void debugLogService.info('Chrome command listener fired', { command });
  void handler.handle(command);
});