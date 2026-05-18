export class ScreenshotCaptureService {
  async captureVisibleViewport(): Promise<string> {
    const currentWindow = await chrome.windows.getCurrent({ populate: false });
    if (!currentWindow.id) {
      throw new Error('No active browser window found.');
    }

    const dataUrl = await chrome.tabs.captureVisibleTab(currentWindow.id, {
      format: 'png',
    });

    if (!dataUrl) {
      throw new Error('Failed to capture the visible viewport.');
    }

    return dataUrl;
  }
}