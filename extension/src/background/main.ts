import { CaptureScreenshotCommandHandler } from './CaptureScreenshotCommandHandler';
import { ExtensionSettingsRepository } from '../services/ExtensionSettingsRepository';
import { ExtensionSettingsValidator } from '../services/ExtensionSettingsValidator';
import { NotificationService } from '../services/NotificationService';
import { ScreenshotCaptureService } from '../services/ScreenshotCaptureService';
import { StudyForgeApiClient } from '../services/StudyForgeApiClient';

const notificationService = new NotificationService();
notificationService.attachClickHandlers();

const handler = new CaptureScreenshotCommandHandler({
  settingsRepository: new ExtensionSettingsRepository(),
  settingsValidator: new ExtensionSettingsValidator(),
  screenshotCaptureService: new ScreenshotCaptureService(),
  studyForgeApiClient: new StudyForgeApiClient(),
  notificationService,
});

chrome.commands.onCommand.addListener((command) => {
  void handler.handle(command);
});