import { useEffect, useMemo, useState } from 'react';
import { Check, ExternalLink, Folder, KeyRound, Keyboard, Link, RefreshCw, Save, Trash2 } from 'lucide-react';
import { CAPTURE_SCREENSHOT_COMMAND, CommandShortcut, DebugLogEntry, DEFAULT_API_BASE_URL, DEFAULT_SETTINGS, ExtensionSettings } from '../types';
import { DebugLogService } from '../services/DebugLogService';
import { ExtensionHostPermissionService } from '../services/ExtensionHostPermissionService';
import { ExtensionSettingsRepository } from '../services/ExtensionSettingsRepository';
import { ExtensionSettingsValidator } from '../services/ExtensionSettingsValidator';

export const App = () => {
  const debugLogService = useMemo(() => new DebugLogService(), []);
  const hostPermissionService = useMemo(() => new ExtensionHostPermissionService(), []);
  const settingsRepository = useMemo(() => new ExtensionSettingsRepository(), []);
  const settingsValidator = useMemo(() => new ExtensionSettingsValidator(), []);
  const [settings, setSettings] = useState<ExtensionSettings>(DEFAULT_SETTINGS);
  const [commands, setCommands] = useState<CommandShortcut[]>([]);
  const [debugEntries, setDebugEntries] = useState<DebugLogEntry[]>([]);
  const [status, setStatus] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let isMounted = true;

    Promise.all([settingsRepository.getSettings(), getCommands(), debugLogService.getEntries()])
      .then(([savedSettings, registeredCommands, storedDebugEntries]) => {
        if (!isMounted) {
          return;
        }

        setSettings(savedSettings);
        setCommands(registeredCommands);
        setDebugEntries(storedDebugEntries);
      })
      .catch((error: unknown) => {
        setStatus(error instanceof Error ? error.message : 'Unable to load settings.');
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [debugLogService, settingsRepository]);

  const shortcut = commands.find((command) => command.name === CAPTURE_SCREENSHOT_COMMAND)?.shortcut || 'Unassigned';

  const updateField = (field: keyof Omit<ExtensionSettings, 'directoryMappings'>, value: string) => {
    setSettings((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const updateDirectoryMapping = (directoryId: string) => {
    setSettings((current) => ({
      ...current,
      directoryMappings: {
        ...current.directoryMappings,
        [CAPTURE_SCREENSHOT_COMMAND]: directoryId,
      },
    }));
  };

  const handleSave = async () => {
    const validationErrors = settingsValidator.validateSettings(settings);
    if (validationErrors.length > 0) {
      setStatus(validationErrors.join(' '));
      return;
    }

    setIsSaving(true);
    setStatus('');
    try {
      await hostPermissionService.requestConfiguredHosts(settings);
      await settingsRepository.saveSettings(settings);
      setStatus('Saved');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to save settings.');
    } finally {
      setIsSaving(false);
    }
  };

  const openShortcutSettings = () => {
    void chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
  };

  const refreshDebugEntries = async () => {
    try {
      setDebugEntries(await debugLogService.getEntries());
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to load debug output.');
    }
  };

  const clearDebugEntries = async () => {
    try {
      await debugLogService.clear();
      setDebugEntries([]);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to clear debug output.');
    }
  };

  if (isLoading) {
    return <main className="popup-shell loading">Loading...</main>;
  }

  return (
    <main className="popup-shell">
      <header className="popup-header">
        <div>
          <p className="eyebrow">StudyForge</p>
          <h1>Capture</h1>
        </div>
        <button className="icon-button" type="button" title="Open shortcut settings" onClick={openShortcutSettings}>
          <Keyboard aria-hidden="true" size={18} />
        </button>
      </header>

      <section className="settings-section">
        <label className="field">
          <span><KeyRound aria-hidden="true" size={14} /> API key</span>
          <input
            type="password"
            value={settings.apiKey}
            placeholder="sf-..."
            onChange={(event) => updateField('apiKey', event.target.value)}
          />
        </label>

        <label className="field">
          <span><Link aria-hidden="true" size={14} /> API URL</span>
          <input
            type="url"
            value={settings.apiBaseUrl}
            placeholder={DEFAULT_API_BASE_URL}
            onChange={(event) => updateField('apiBaseUrl', event.target.value)}
          />
        </label>

        <label className="field">
          <span><ExternalLink aria-hidden="true" size={14} /> App URL</span>
          <input
            type="url"
            value={settings.appBaseUrl}
            onChange={(event) => updateField('appBaseUrl', event.target.value)}
          />
        </label>
      </section>

      <section className="settings-section command-section">
        <div className="command-header">
          <div>
            <p className="eyebrow">Command</p>
            <h2>{shortcut}</h2>
          </div>
          <span className="shortcut-state">{CAPTURE_SCREENSHOT_COMMAND}</span>
        </div>

        <label className="field">
          <span><Folder aria-hidden="true" size={14} /> Directory ID</span>
          <input
            type="text"
            value={settings.directoryMappings[CAPTURE_SCREENSHOT_COMMAND] || ''}
            placeholder="Directory ID"
            onChange={(event) => updateDirectoryMapping(event.target.value)}
          />
        </label>
      </section>

      <section className="settings-section debug-section">
        <div className="debug-header">
          <div>
            <p className="eyebrow">Debug</p>
            <h2>Last hotkey output</h2>
          </div>
          <div className="debug-actions">
            <button className="icon-button" type="button" title="Refresh debug output" onClick={refreshDebugEntries}>
              <RefreshCw aria-hidden="true" size={16} />
            </button>
            <button className="icon-button" type="button" title="Clear debug output" onClick={clearDebugEntries}>
              <Trash2 aria-hidden="true" size={16} />
            </button>
          </div>
        </div>
        {debugEntries.length > 0 ? (
          <ol className="debug-list">
            {debugEntries.slice(-8).reverse().map((entry) => (
              <li className={`debug-entry ${entry.level}`} key={`${entry.timestamp}-${entry.message}`}>
                <span className="debug-time">{formatDebugTime(entry.timestamp)}</span>
                <span className="debug-message">{entry.message}</span>
                {entry.details ? <code>{entry.details}</code> : null}
              </li>
            ))}
          </ol>
        ) : (
          <p className="debug-empty">No debug output yet.</p>
        )}
      </section>

      <footer className="popup-footer">
        <button className="save-button" type="button" onClick={handleSave} disabled={isSaving}>
          {status === 'Saved' ? <Check aria-hidden="true" size={16} /> : <Save aria-hidden="true" size={16} />}
          {status === 'Saved' ? 'Saved' : 'Save'}
        </button>
        {status && status !== 'Saved' ? <p className="status error">{status}</p> : null}
      </footer>
    </main>
  );
};

async function getCommands(): Promise<CommandShortcut[]> {
  return chrome.commands.getAll();
}

function formatDebugTime(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return timestamp;
  }

  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}