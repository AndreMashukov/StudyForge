import { useEffect, useMemo, useState } from 'react';
import { Check, ExternalLink, Folder, KeyRound, Keyboard, Link, Save } from 'lucide-react';
import { CAPTURE_SCREENSHOT_COMMAND, CommandShortcut, DEFAULT_SETTINGS, ExtensionSettings } from '../types';
import { ExtensionSettingsRepository } from '../services/ExtensionSettingsRepository';
import { ExtensionSettingsValidator } from '../services/ExtensionSettingsValidator';

export const App = () => {
  const settingsRepository = useMemo(() => new ExtensionSettingsRepository(), []);
  const settingsValidator = useMemo(() => new ExtensionSettingsValidator(), []);
  const [settings, setSettings] = useState<ExtensionSettings>(DEFAULT_SETTINGS);
  const [commands, setCommands] = useState<CommandShortcut[]>([]);
  const [status, setStatus] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let isMounted = true;

    Promise.all([settingsRepository.getSettings(), getCommands()])
      .then(([savedSettings, registeredCommands]) => {
        if (!isMounted) {
          return;
        }

        setSettings(savedSettings);
        setCommands(registeredCommands);
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
  }, [settingsRepository]);

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