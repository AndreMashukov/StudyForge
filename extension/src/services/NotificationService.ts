const NOTIFICATION_TARGET_PREFIX = 'notificationTarget:';
const ICON_URL = 'icons/icon-128.png';

export class NotificationService {
  attachClickHandlers(): void {
    chrome.notifications.onClicked.addListener((notificationId) => {
      void this.openNotificationTarget(notificationId);
    });

    chrome.notifications.onButtonClicked.addListener((notificationId) => {
      void this.openNotificationTarget(notificationId);
    });

    chrome.notifications.onClosed.addListener((notificationId) => {
      void chrome.storage.local.remove(this.storageKey(notificationId));
    });
  }

  async showProgress(): Promise<void> {
    await this.createNotification({
      title: 'StudyForge Capture',
      message: 'Capturing viewport...',
    });
  }

  async showSuccess(title: string, documentUrl: string): Promise<void> {
    const notificationId = `studyforge-capture-${Date.now()}`;
    await chrome.storage.local.set({
      [this.storageKey(notificationId)]: documentUrl,
    });
    await this.createNotification({
      notificationId,
      title: 'StudyForge Capture',
      message: `Created ${title}`,
      buttons: [{ title: 'Open document' }],
    });
  }

  async showError(message: string): Promise<void> {
    await this.createNotification({
      title: 'StudyForge Capture',
      message,
    });
  }

  private async openNotificationTarget(notificationId: string): Promise<void> {
    const key = this.storageKey(notificationId);
    const result = await chrome.storage.local.get(key);
    const url = result[key];
    if (typeof url !== 'string') {
      return;
    }

    await chrome.tabs.create({ url });
    await chrome.notifications.clear(notificationId);
    await chrome.storage.local.remove(key);
  }

  private createNotification({
    notificationId,
    title,
    message,
    buttons,
  }: {
    notificationId?: string;
    title: string;
    message: string;
    buttons?: chrome.notifications.NotificationButton[];
  }): Promise<string> {
    const options: chrome.notifications.NotificationCreateOptions = {
      type: 'basic',
      iconUrl: chrome.runtime.getURL(ICON_URL),
      title,
      message,
      silent: true,
      buttons,
    };

    return new Promise((resolve, reject) => {
      const callback = (createdNotificationId: string) => {
        const error = chrome.runtime.lastError;
        if (error) {
          reject(new Error(error.message));
          return;
        }

        resolve(createdNotificationId);
      };

      if (notificationId) {
        chrome.notifications.create(notificationId, options, callback);
        return;
      }

      chrome.notifications.create(options, callback);
    });
  }

  private storageKey(notificationId: string): string {
    return `${NOTIFICATION_TARGET_PREFIX}${notificationId}`;
  }
}