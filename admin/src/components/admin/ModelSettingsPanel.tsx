'use client';

import type {
  IGeminiImageProviderConnection,
  IGeminiProviderConnection,
  IOpenRouterConnectionTestResult,
  IOpenRouterProviderConnection,
} from '@shared-types';
import { Button, Input, Label } from '@study-forge/ui';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { Badge } from '../ui/Badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../ui/Card';

type NoticeState =
  | {
      type: 'success' | 'error';
      message: string;
    }
  | null;

export interface IModelSettingsPanelProps {
  geminiConnection: IGeminiProviderConnection;
  geminiImageConnection: IGeminiImageProviderConnection;
  openRouterConnection: IOpenRouterProviderConnection;
  encryptionConfigured: boolean;
}

interface IRouteResponse {
  success?: boolean;
  message?: string;
  openRouterConnection?: IOpenRouterProviderConnection;
  geminiImageConnection?: IGeminiImageProviderConnection;
  result?: IOpenRouterConnectionTestResult;
}

function formatDate(value?: string): string {
  if (!value) {
    return '—';
  }

  return new Date(value).toLocaleString();
}

function getStatusVariant(status?: string): 'default' | 'secondary' | 'outline' {
  if (status === 'healthy') {
    return 'default';
  }

  if (status === 'unhealthy') {
    return 'secondary';
  }

  return 'outline';
}

export function ModelSettingsPanel({
  geminiConnection,
  geminiImageConnection: initialGeminiImageConnection,
  openRouterConnection: initialOpenRouterConnection,
  encryptionConfigured,
}: IModelSettingsPanelProps) {
  const router = useRouter();
  const [geminiImageConnection, setGeminiImageConnection] = useState(
    initialGeminiImageConnection
  );
  const [imageEnabled, setImageEnabled] = useState(initialGeminiImageConnection.enabled);
  const [imageModel, setImageModel] = useState(initialGeminiImageConnection.defaultModel);
  const [isSavingImage, setIsSavingImage] = useState(false);
  const [openRouterConnection, setOpenRouterConnection] = useState(
    initialOpenRouterConnection
  );
  const [enabled, setEnabled] = useState(initialOpenRouterConnection.enabled);
  const [baseUrl, setBaseUrl] = useState(initialOpenRouterConnection.baseUrl);
  const [defaultModel, setDefaultModel] = useState(
    initialOpenRouterConnection.defaultModel
  );
  const [defaultVisionModel, setDefaultVisionModel] = useState(
    initialOpenRouterConnection.defaultVisionModel ?? ''
  );
  const [apiKey, setApiKey] = useState('');
  const [notice, setNotice] = useState<NoticeState>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice(null);
    setIsSaving(true);

    try {
      const response = await fetch('/api/model-settings/openrouter', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          enabled,
          baseUrl,
          defaultModel,
          defaultVisionModel,
          apiKey: apiKey.trim() ? apiKey : undefined,
        }),
      });
      const payload = (await response.json()) as IRouteResponse;

      if (!response.ok || !payload.success || !payload.openRouterConnection) {
        throw new Error(payload.message || 'Failed to save OpenRouter settings.');
      }

      setOpenRouterConnection(payload.openRouterConnection);
      setEnabled(payload.openRouterConnection.enabled);
      setBaseUrl(payload.openRouterConnection.baseUrl);
      setDefaultModel(payload.openRouterConnection.defaultModel);
      setDefaultVisionModel(payload.openRouterConnection.defaultVisionModel ?? '');
      setApiKey('');
      setNotice({
        type: 'success',
        message: 'OpenRouter settings saved.',
      });
      router.refresh();
    } catch (error) {
      setNotice({
        type: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to save OpenRouter settings.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveImage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice(null);
    setIsSavingImage(true);

    try {
      const response = await fetch('/api/model-settings/gemini-image', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: imageEnabled,
          defaultModel: imageModel,
        }),
      });
      const payload = (await response.json()) as IRouteResponse;

      if (!response.ok || !payload.success || !payload.geminiImageConnection) {
        throw new Error(payload.message || 'Failed to save image model settings.');
      }

      setGeminiImageConnection(payload.geminiImageConnection);
      setImageEnabled(payload.geminiImageConnection.enabled);
      setImageModel(payload.geminiImageConnection.defaultModel);
      setNotice({
        type: 'success',
        message: 'Image generation settings saved.',
      });
      router.refresh();
    } catch (error) {
      setNotice({
        type: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to save image model settings.',
      });
    } finally {
      setIsSavingImage(false);
    }
  };

  const handleTest = async () => {
    setNotice(null);
    setIsTesting(true);

    try {
      const response = await fetch('/api/model-settings/openrouter/test', {
        method: 'POST',
      });
      const payload = (await response.json()) as IRouteResponse;

      if (!response.ok || !payload.result || !payload.openRouterConnection) {
        throw new Error(payload.message || 'Failed to test OpenRouter settings.');
      }

      setOpenRouterConnection(payload.openRouterConnection);
      setNotice({
        type: payload.result.success ? 'success' : 'error',
        message: payload.result.message,
      });
      router.refresh();
    } catch (error) {
      setNotice({
        type: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to test OpenRouter settings.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="space-y-6">
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle className="text-xl">Gemini</CardTitle>
            <Badge variant="outline">Server managed</Badge>
          </div>
          <CardDescription>
            Gemini keeps using the existing deployment secret and is not editable
            from the admin app.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-border p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Credential source
              </p>
              <p className="mt-2 font-medium">{geminiConnection.secretRef}</p>
            </div>
            <div className="rounded-lg border border-border p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Default model
              </p>
              <p className="mt-2 font-medium">{geminiConnection.defaultModel}</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Use this page to introduce OpenRouter without changing the existing
            Gemini credential path.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-xl">OpenRouter</CardTitle>
            <Badge variant={getStatusVariant(openRouterConnection.lastValidationStatus)}>
              {openRouterConnection.lastValidationStatus || 'unknown'}
            </Badge>
            <Badge variant="outline">
              {openRouterConnection.apiKeyConfigured
                ? 'API key configured'
                : 'API key missing'}
            </Badge>
          </div>
          <CardDescription>
            Configure the OpenRouter API key and default model from the admin app.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {!encryptionConfigured ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
              Set <strong>LLM_SETTINGS_ENCRYPTION_KEY</strong> on the admin app
              before saving OpenRouter credentials.
            </div>
          ) : null}

          <form className="space-y-4" onSubmit={handleSave}>
            <label className="flex items-center gap-3 rounded-lg border border-border p-4 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-border bg-input"
                checked={enabled}
                onChange={(event) => setEnabled(event.target.checked)}
              />
              <span>
                <span className="block font-medium">Enable OpenRouter</span>
                <span className="text-muted-foreground">
                  Makes the saved OpenRouter connection available for routing.
                </span>
              </span>
            </label>

            <div className="space-y-2">
              <Label htmlFor="openrouter-base-url">Base URL</Label>
              <Input
                id="openrouter-base-url"
                value={baseUrl}
                onChange={(event) => setBaseUrl(event.target.value)}
                placeholder="https://openrouter.ai/api/v1"
                autoComplete="off"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="openrouter-model">Default text model</Label>
              <Input
                id="openrouter-model"
                value={defaultModel}
                onChange={(event) => setDefaultModel(event.target.value)}
                placeholder="anthropic/claude-sonnet-4.6"
                autoComplete="off"
                required
              />
              <p className="text-xs text-muted-foreground">
                Used for quiz, flashcards, documents, chat, and other text generation.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="openrouter-vision-model">Default vision model</Label>
              <Input
                id="openrouter-vision-model"
                value={defaultVisionModel}
                onChange={(event) => setDefaultVisionModel(event.target.value)}
                placeholder="google/gemini-2.5-flash"
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground">
                Used for screenshot and image input to text. Leave empty to use Gemini for
                screenshots.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="openrouter-api-key">API key</Label>
              <Input
                id="openrouter-api-key"
                type="password"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder={
                  openRouterConnection.apiKeyConfigured
                    ? 'Leave blank to keep the current key'
                    : 'Paste OpenRouter API key'
                }
                autoComplete="new-password"
              />
              <p className="text-xs text-muted-foreground">
                The key is encrypted server-side and never returned after save.
              </p>
            </div>

            {notice ? (
              <p
                className={
                  notice.type === 'success'
                    ? 'text-sm text-primary'
                    : 'text-sm text-destructive'
                }
                role="alert"
              >
                {notice.message}
              </p>
            ) : null}

            <div className="flex flex-wrap gap-3">
              <Button type="submit" disabled={isSaving || !encryptionConfigured}>
                {isSaving ? 'Saving…' : 'Save OpenRouter settings'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={handleTest}
                disabled={
                  isTesting ||
                  !encryptionConfigured ||
                  !openRouterConnection.apiKeyConfigured
                }
              >
                {isTesting ? 'Testing…' : 'Test saved connection'}
              </Button>
            </div>
          </form>

          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <div className="rounded-lg border border-border p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Last updated
              </p>
              <p className="mt-2">{formatDate(openRouterConnection.updatedAt)}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                by {openRouterConnection.updatedBy || '—'}
              </p>
            </div>
            <div className="rounded-lg border border-border p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Last validation
              </p>
              <p className="mt-2">{formatDate(openRouterConnection.lastValidatedAt)}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {openRouterConnection.lastValidationError || 'No validation error recorded.'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>

    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-xl">Image generation</CardTitle>
          <Badge variant="outline">Gemini</Badge>
        </div>
        <CardDescription>
          Slide deck images use a separate Gemini image model. This is not routed
          through the OpenRouter text default above.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <form className="space-y-4" onSubmit={handleSaveImage}>
          <label className="flex items-center gap-3 rounded-lg border border-border p-4 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-border bg-input"
              checked={imageEnabled}
              onChange={(event) => setImageEnabled(event.target.checked)}
            />
            <span>
              <span className="block font-medium">Enable image generation</span>
              <span className="text-muted-foreground">
                Uses {geminiImageConnection.secretRef} from deployment secrets.
              </span>
            </span>
          </label>

          <div className="space-y-2">
            <Label htmlFor="gemini-image-model">Default image model</Label>
            <Input
              id="gemini-image-model"
              value={imageModel}
              onChange={(event) => setImageModel(event.target.value)}
              placeholder="gemini-3.1-flash-image-preview"
              autoComplete="off"
              required
            />
          </div>

          <Button type="submit" disabled={isSavingImage}>
            {isSavingImage ? 'Saving…' : 'Save image settings'}
          </Button>
        </form>

        <div className="rounded-lg border border-border p-4 text-sm">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Last updated
          </p>
          <p className="mt-2">{formatDate(geminiImageConnection.updatedAt)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            by {geminiImageConnection.updatedBy || '—'}
          </p>
        </div>
      </CardContent>
    </Card>
    </div>
  );
}