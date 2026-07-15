import { ExtensionSettings } from '../types';

export interface CommandValidationResult {
  directoryId: string;
}

export class ExtensionSettingsValidator {
  validateSettings(settings: ExtensionSettings): string[] {
    const errors: string[] = [];

    if (!this.isValidUrl(settings.apiBaseUrl)) {
      errors.push('API URL is invalid.');
    }

    if (!this.isValidUrl(settings.appBaseUrl)) {
      errors.push('App URL is invalid.');
    }

    return errors;
  }

  validateForCommand(settings: ExtensionSettings, command: string): CommandValidationResult {
    const errors = this.validateSettings(settings);

    if (!settings.apiKey.trim()) {
      errors.push('API key is required.');
    } else if (!this.isSupportedApiKey(settings.apiKey)) {
      errors.push('API key must start with sf-.');
    }

    const directoryId = settings.directoryMappings[command]?.trim();
    if (!directoryId) {
      errors.push('Directory ID is required.');
    }

    if (errors.length > 0) {
      throw new Error(errors.join(' '));
    }

    return { directoryId };
  }

  private isSupportedApiKey(apiKey: string): boolean {
    const trimmedKey = apiKey.trim();
    return trimmedKey.startsWith('sf-');
  }

  private isValidUrl(value: string): boolean {
    try {
      const url = new URL(value);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }
}