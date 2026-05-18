import { DEBUG_LOG_STORAGE_KEY, DebugLogEntry } from '../types';

const LOG_PREFIX = '[StudyForge Extension]';
const MAX_DEBUG_LOG_ENTRIES = 30;

export class DebugLogService {
  async info(message: string, details?: unknown): Promise<void> {
    await this.write('info', message, details);
  }

  async error(message: string, details?: unknown): Promise<void> {
    await this.write('error', message, details);
  }

  async getEntries(): Promise<DebugLogEntry[]> {
    const result = await chrome.storage.local.get(DEBUG_LOG_STORAGE_KEY);
    const entries = result[DEBUG_LOG_STORAGE_KEY];

    if (!Array.isArray(entries)) {
      return [];
    }

    return entries.filter((entry): entry is DebugLogEntry => (
      typeof entry === 'object'
      && entry !== null
      && typeof entry.timestamp === 'string'
      && (entry.level === 'info' || entry.level === 'error')
      && typeof entry.message === 'string'
    ));
  }

  async clear(): Promise<void> {
    await chrome.storage.local.remove(DEBUG_LOG_STORAGE_KEY);
  }

  private async write(level: DebugLogEntry['level'], message: string, details?: unknown): Promise<void> {
    const formattedDetails = this.formatDetails(details);
    const entry: DebugLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...(formattedDetails ? { details: formattedDetails } : {}),
    };

    if (level === 'error') {
      console.error(LOG_PREFIX, message, details ?? '');
    } else {
      console.log(LOG_PREFIX, message, details ?? '');
    }

    try {
      const entries = await this.getEntries();
      await chrome.storage.local.set({
        [DEBUG_LOG_STORAGE_KEY]: [...entries, entry].slice(-MAX_DEBUG_LOG_ENTRIES),
      });
    } catch (error) {
      console.warn(`${LOG_PREFIX} Failed to store debug log entry`, error);
    }
  }

  private formatDetails(details: unknown): string | undefined {
    if (details === undefined || details === null) {
      return undefined;
    }

    if (details instanceof Error) {
      return details.stack || details.message;
    }

    if (typeof details === 'string') {
      return details;
    }

    try {
      return JSON.stringify(details);
    } catch {
      return String(details);
    }
  }
}