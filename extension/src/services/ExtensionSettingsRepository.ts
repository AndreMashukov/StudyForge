import { DEFAULT_SETTINGS, ExtensionSettings } from '../types';

const SETTINGS_STORAGE_KEY = 'settings';

export class ExtensionSettingsRepository {
  async getSettings(): Promise<ExtensionSettings> {
    const storedSettings = await chrome.storage.local.get(SETTINGS_STORAGE_KEY);
    return this.mergeSettings(storedSettings[SETTINGS_STORAGE_KEY]);
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

    return {
      ...DEFAULT_SETTINGS,
      ...value,
      directoryMappings: {
        ...DEFAULT_SETTINGS.directoryMappings,
        ...(value.directoryMappings || {}),
      },
    };
  }
}