import { useEffect, useMemo, useState } from 'react';
import { Check, ExternalLink, Folder, KeyRound, Keyboard, Link, Plus, RefreshCw, Save, Trash2, X } from 'lucide-react';
import { CAPTURE_COMMANDS, CAPTURE_SCREENSHOT_COMMAND, CommandShortcut, DebugLogEntry, DEFAULT_API_BASE_URL, DEFAULT_SETTINGS, ExtensionSettings } from '../types';
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
  const [activeMappingCommands, setActiveMappingCommands] = useState<string[]>([CAPTURE_SCREENSHOT_COMMAND]);
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
        setActiveMappingCommands(getInitialActiveMappingCommands(savedSettings));
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

  const activeCaptureCommands = CAPTURE_COMMANDS.filter((command) => activeMappingCommands.includes(command.id));
  const canAddMapping = activeMappingCommands.length < CAPTURE_COMMANDS.length;

  const updateField = (field: keyof Omit<ExtensionSettings, 'directoryMappings'>, value: string) => {
    setSettings((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const updateDirectoryMapping = (commandId: string, directoryId: string) => {
    setSettings((current) => ({
      ...current,
      directoryMappings: {
        ...current.directoryMappings,
        [commandId]: directoryId,
      },
    }));
  };

  const addMapping = () => {
    const nextCommand = CAPTURE_COMMANDS.find((command) => !activeMappingCommands.includes(command.id));
    if (!nextCommand) {
      return;
    }

    setActiveMappingCommands((current) => [...current, nextCommand.id]);
  };

  const removeMapping = (commandId: string) => {
    setActiveMappingCommands((current) => current.filter((activeCommandId) => activeCommandId !== commandId));
    updateDirectoryMapping(commandId, '');
  };

  const handleSave = async () => {
    const settingsToSave = buildSettingsForSave(settings, activeMappingCommands);
    const validationErrors = [
      ...settingsValidator.validateSettings(settingsToSave),
      ...validateActiveMappings(settingsToSave, activeMappingCommands),
    ];

    if (validationErrors.length > 0) {
      setStatus(validationErrors.join(' '));
      return;
    }

    setIsSaving(true);
    setStatus('');
    try {
      await hostPermissionService.requestConfiguredHosts(settingsToSave);
      await settingsRepository.saveSettings(settingsToSave);
      setSettings(settingsToSave);
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
            <p className="eyebrow">Mappings</p>
            <h2>{activeMappingCommands.length} / {CAPTURE_COMMANDS.length}</h2>
          </div>
          <button className="add-button" type="button" onClick={addMapping} disabled={!canAddMapping}>
            <Plus aria-hidden="true" size={15} />
            Add
          </button>
        </div>

        {activeCaptureCommands.length > 0 ? (
          <div className="mapping-list">
            {activeCaptureCommands.map((captureCommand) => (
              <div className="mapping-row" key={captureCommand.id}>
                <div className="mapping-row-header">
                  <div className="mapping-meta">
                    <span className="mapping-label">{captureCommand.label}</span>
                    <span className="shortcut-state">{getShortcutLabel(commands, captureCommand.id)}</span>
                  </div>
                  <button
                    className="remove-button"
                    type="button"
                    title={`Remove ${captureCommand.label}`}
                    onClick={() => removeMapping(captureCommand.id)}
                  >
                    <X aria-hidden="true" size={15} />
                  </button>
                </div>
                <label className="field">
                  <span><Folder aria-hidden="true" size={14} /> Directory ID</span>
                  <input
                    type="text"
                    value={settings.directoryMappings[captureCommand.id] || ''}
                    placeholder="Directory ID"
                    onChange={(event) => updateDirectoryMapping(captureCommand.id, event.target.value)}
                  />
                </label>
              </div>
            ))}
          </div>
        ) : (
          <p className="mapping-empty">No mappings configured.</p>
        )}
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

function getInitialActiveMappingCommands(settings: ExtensionSettings): string[] {
  const configuredCommands = CAPTURE_COMMANDS
    .filter((command) => settings.directoryMappings[command.id]?.trim())
    .map((command) => command.id);

  return configuredCommands.length > 0 ? configuredCommands : [CAPTURE_SCREENSHOT_COMMAND];
}

function getShortcutLabel(commands: CommandShortcut[], commandId: string): string {
  return commands.find((command) => command.name === commandId)?.shortcut || 'Unassigned';
}

function buildSettingsForSave(settings: ExtensionSettings, activeCommandIds: string[]): ExtensionSettings {
  const directoryMappings = CAPTURE_COMMANDS.reduce<Record<string, string>>((mappings, command) => ({
    ...mappings,
    [command.id]: activeCommandIds.includes(command.id)
      ? settings.directoryMappings[command.id]?.trim() || ''
      : '',
  }), {});

  return {
    ...settings,
    directoryMappings,
  };
}

function validateActiveMappings(settings: ExtensionSettings, activeCommandIds: string[]): string[] {
  return CAPTURE_COMMANDS
    .filter((command) => activeCommandIds.includes(command.id) && !settings.directoryMappings[command.id]?.trim())
    .map((command) => `${command.label} directory ID is required.`);
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