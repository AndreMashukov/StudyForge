import { ExtensionSettings } from '../types';

export class ExtensionHostPermissionService {
  async requestConfiguredHosts(settings: ExtensionSettings): Promise<void> {
    const origins = this.getPermissionOrigins(settings);
    const hasPermissions = await chrome.permissions.contains({ origins });
    if (hasPermissions) {
      return;
    }

    const granted = await chrome.permissions.request({ origins });
    if (!granted) {
      throw new Error('Host permission for configured URLs is required.');
    }
  }

  private getPermissionOrigins(settings: ExtensionSettings): string[] {
    return Array.from(new Set([
      this.toOriginPattern(settings.apiBaseUrl),
      this.toOriginPattern(settings.appBaseUrl),
    ]));
  }

  private toOriginPattern(value: string): string {
    const url = new URL(value);
    return `${url.origin}/*`;
  }
}
