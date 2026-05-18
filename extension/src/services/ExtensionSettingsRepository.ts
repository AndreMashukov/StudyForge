import { DEFAULT_API_BASE_URL, DEFAULT_SETTINGS, ExtensionSettings } from '../types';

const SETTINGS_STORAGE_KEY = 'settings';
const LEGACY_API_BASE_URLS = new Set([
  'https://asia-east1-studyforge.cloudfunctions.net/api',
]);

export class ExtensionSettingsRepository {
  async getSettings(): Promise<ExtensionSettings> {
    const storedSettings = await chrome.storage.local.get(SETTINGS_STORAGE_KEY);
    const rawSettings = storedSettings[SETTINGS_STORAGE_KEY];
    const settings = this.mergeSettings(rawSettings);

    if (this.shouldPersistNormalizedSettings(rawSettings)) {
      await this.saveSettings(settings);
    }

    return settings;
  }

  async saveSettings(settings: ExtensionSettings): Promise<void> {
    await chrome.storage.local.set({
      [SETTINGS_STORAGE_KEY]: this.mergeSettings(settings),
    });
  }

  private mergeSettings(settings: unknown): ExtensionSettings {
    const value = typeof settings === 'object' && settings !== null
      ? settings as Partial<ExtensionSettings>
      : {};

    const mergedSettings = {
      ...DEFAULT_SETTINGS,
      ...value,
      directoryMappings: {
        ...DEFAULT_SETTINGS.directoryMappings,
        ...(value.directoryMappings || {}),
      },
    };

    return {
      ...mergedSettings,
      apiBaseUrl: this.normalizeApiBaseUrl(mergedSettings.apiBaseUrl),
    };
  }

  private normalizeApiBaseUrl(apiBaseUrl: string): string {
    const trimmedApiBaseUrl = apiBaseUrl.trim().replace(/\/+$/, '');
    if (!trimmedApiBaseUrl || LEGACY_API_BASE_URLS.has(trimmedApiBaseUrl)) {
      return DEFAULT_API_BASE_URL;
    }

    return apiBaseUrl;
  }

  private shouldPersistNormalizedSettings(settings: unknown): boolean {
    if (typeof settings !== 'object' || settings === null || !('apiBaseUrl' in settings)) {
      return false;
    }

    const apiBaseUrl = (settings as Partial<ExtensionSettings>).apiBaseUrl;
    return typeof apiBaseUrl === 'string' && this.normalizeApiBaseUrl(apiBaseUrl) !== apiBaseUrl;
  }
}