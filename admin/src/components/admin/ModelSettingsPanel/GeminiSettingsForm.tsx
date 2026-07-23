'use client';

import type {
  IGeminiConnectionTestResult,
  IGeminiProviderConnection,
} from '@shared-types';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Label } from '@study-forge/ui';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import {
  isAdminUnauthorizedResponse,
  redirectToAdminLogin,
} from '../../../lib/auth/client-login-redirect';
import {
  formatModelsSyncedAt,
  isModelInCatalogForModality,
} from '../../../lib/provider-model-catalog-ui';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../ui/Card';
import { Input } from '../../ui/Input';
import { ConnectionModelSelect } from '../ConnectionModelSelect';
import {
  geminiSettingsFormSchema,
  getGeminiSettingsDefaultValues,
  normalizeGeminiSettingsSubmitPayload,
  type IGeminiSettingsFormValues,
} from './GeminiSettingsForm.form';

type NoticeState =
  | {
      type: 'success' | 'error';
      message: string;
    }
  | null;

export interface IGeminiSettingsFormProps {
  geminiConnection: IGeminiProviderConnection;
  encryptionConfigured: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isGeminiProviderConnection(value: unknown): value is IGeminiProviderConnection {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.providerKind === 'gemini' &&
    typeof value.label === 'string' &&
    value.credentialMode === 'encrypted-firestore' &&
    typeof value.apiKeyConfigured === 'boolean' &&
    typeof value.defaultModel === 'string'
  );
}

function isGeminiConnectionTestResult(value: unknown): value is IGeminiConnectionTestResult {
  if (!isRecord(value)) {
    return false;
  }

  return typeof value.success === 'boolean' && typeof value.message === 'string';
}

export function GeminiSettingsForm({
  geminiConnection: initialGeminiConnection,
  encryptionConfigured,
}: IGeminiSettingsFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [geminiConnection, setGeminiConnection] = useState(initialGeminiConnection);
  const [notice, setNotice] = useState<NoticeState>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  const form = useForm<IGeminiSettingsFormValues>({
    resolver: zodResolver(geminiSettingsFormSchema),
    defaultValues: getGeminiSettingsDefaultValues(initialGeminiConnection),
  });

  const defaultModelValue = useWatch({ control: form.control, name: 'defaultModel' }) ?? '';
  const defaultVisionModelValue =
    useWatch({ control: form.control, name: 'defaultVisionModel' }) ?? '';
  const defaultImageModelValue =
    useWatch({ control: form.control, name: 'defaultImageModel' }) ?? '';
  const availableModels = geminiConnection.availableModels ?? [];
  const hasModelCatalog = availableModels.length > 0;

  const handleSave = async (values: IGeminiSettingsFormValues) => {
    setNotice(null);

    if (hasModelCatalog) {
      if (!isModelInCatalogForModality(availableModels, values.defaultModel, 'text')) {
        setNotice({
          type: 'error',
          message: 'Default text model is not in the uploaded catalog.',
        });
        return;
      }

      const visionModel = values.defaultVisionModel?.trim();
      if (
        visionModel &&
        !isModelInCatalogForModality(availableModels, visionModel, 'vision')
      ) {
        setNotice({
          type: 'error',
          message: 'Default vision model is not in the uploaded catalog.',
        });
        return;
      }

      const imageModel = values.defaultImageModel?.trim();
      if (
        imageModel &&
        !isModelInCatalogForModality(availableModels, imageModel, 'image')
      ) {
        setNotice({
          type: 'error',
          message: 'Default image model is not in the uploaded catalog.',
        });
        return;
      }
    }

    setIsSaving(true);

    try {
      const response = await fetch('/api/model-settings/gemini', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(normalizeGeminiSettingsSubmitPayload(values)),
      });

      if (isAdminUnauthorizedResponse(response)) {
        redirectToAdminLogin(router, pathname);
        return;
      }

      const payload: unknown = await response.json();
      if (
        !response.ok ||
        !isRecord(payload) ||
        payload.success !== true ||
        !isGeminiProviderConnection(payload.geminiConnection)
      ) {
        throw new Error(
          isRecord(payload) && typeof payload.message === 'string'
            ? payload.message
            : 'Failed to save Gemini settings.'
        );
      }

      setGeminiConnection(payload.geminiConnection);
      form.reset(getGeminiSettingsDefaultValues(payload.geminiConnection));
      setNotice({ type: 'success', message: 'Gemini settings saved.' });
      router.refresh();
    } catch (error) {
      setNotice({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to save Gemini settings.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    setNotice(null);
    setIsTesting(true);

    try {
      const response = await fetch('/api/model-settings/gemini/test', { method: 'POST' });

      if (isAdminUnauthorizedResponse(response)) {
        redirectToAdminLogin(router, pathname);
        return;
      }

      const payload: unknown = await response.json();
      if (
        !response.ok ||
        !isRecord(payload) ||
        !isGeminiConnectionTestResult(payload.result) ||
        !isGeminiProviderConnection(payload.geminiConnection)
      ) {
        throw new Error(
          isRecord(payload) && typeof payload.message === 'string'
            ? payload.message
            : 'Failed to test Gemini settings.'
        );
      }

      setGeminiConnection(payload.geminiConnection);
      setNotice({
        type: payload.result.success ? 'success' : 'error',
        message: payload.result.message,
      });
      router.refresh();
    } catch (error) {
      setNotice({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to test Gemini settings.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Gemini settings</CardTitle>
        <CardDescription>
          Store the Gemini API key encrypted in Firestore, like other provider connections.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {!encryptionConfigured ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            Set <strong>LLM_SETTINGS_ENCRYPTION_KEY</strong> on the admin app before saving
            Gemini credentials.
          </div>
        ) : null}

        <form className="space-y-4" onSubmit={form.handleSubmit(handleSave)}>
          <div className="space-y-2">
            <Label htmlFor="gemini-model">Default text model</Label>
            <ConnectionModelSelect
              control={form.control}
              name="defaultModel"
              models={availableModels}
              modality="text"
              currentValue={defaultModelValue}
              ariaLabel="Default text model"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="gemini-vision-model">Default vision model</Label>
            <ConnectionModelSelect
              control={form.control}
              name="defaultVisionModel"
              models={availableModels}
              modality="vision"
              currentValue={defaultVisionModelValue}
              ariaLabel="Default vision model"
              allowEmpty
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="gemini-image-model">Default image model</Label>
            <ConnectionModelSelect
              control={form.control}
              name="defaultImageModel"
              models={availableModels}
              modality="image"
              currentValue={defaultImageModelValue}
              ariaLabel="Default image model"
              allowEmpty
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="gemini-api-key">API key</Label>
            <Input
              id="gemini-api-key"
              type="password"
              placeholder={
                geminiConnection.apiKeyConfigured
                  ? 'Leave blank to keep the current key'
                  : 'Paste Gemini API key'
              }
              autoComplete="new-password"
              control={form.control}
              name="apiKey"
            />
          </div>

          {notice ? (
            <p
              className={notice.type === 'success' ? 'text-sm text-primary' : 'text-sm text-destructive'}
              role="alert"
            >
              {notice.message}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={isSaving || !encryptionConfigured}>
              {isSaving ? 'Saving…' : 'Save Gemini settings'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={handleTest}
              disabled={isTesting || !encryptionConfigured || !geminiConnection.apiKeyConfigured}
            >
              {isTesting ? 'Testing…' : 'Test saved connection'}
            </Button>
          </div>
        </form>

        <div className="rounded-lg border border-border p-4 text-sm">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Model catalog
          </p>
          <p className="mt-2">{formatModelsSyncedAt(geminiConnection.modelsSyncedAt)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {availableModels.length > 0
              ? `${availableModels.length} models uploaded`
              : 'Test or save with credentials to sync models.'}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
