'use client';

import type {
  ITogetherConnectionTestResult,
  ITogetherProviderConnection,
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
  getTogetherSettingsDefaultValues,
  normalizeTogetherSettingsSubmitPayload,
  togetherSettingsFormSchema,
  type ITogetherSettingsFormValues,
} from './TogetherSettingsForm.form';

type NoticeState =
  | {
      type: 'success' | 'error';
      message: string;
    }
  | null;

export interface ITogetherSettingsFormProps {
  togetherConnection: ITogetherProviderConnection;
  encryptionConfigured: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === 'string';
}

function isOptionalStringOrNull(
  value: unknown
): value is string | null | undefined {
  return value === undefined || value === null || typeof value === 'string';
}

function isOptionalValidationStatus(
  value: unknown
): value is 'unknown' | 'healthy' | 'unhealthy' | undefined {
  return (
    value === undefined ||
    value === 'unknown' ||
    value === 'healthy' ||
    value === 'unhealthy'
  );
}

function isTogetherProviderConnection(
  value: unknown
): value is ITogetherProviderConnection {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.providerKind === 'together' &&
    typeof value.label === 'string' &&
    value.credentialMode === 'encrypted-firestore' &&
    typeof value.apiKeyConfigured === 'boolean' &&
    typeof value.baseUrl === 'string' &&
    typeof value.defaultModel === 'string' &&
    isOptionalString(value.defaultVisionModel) &&
    isOptionalString(value.defaultImageModel) &&
    isOptionalString(value.updatedAt) &&
    isOptionalString(value.updatedBy) &&
    isOptionalString(value.lastValidatedAt) &&
    isOptionalStringOrNull(value.lastValidationError) &&
    isOptionalValidationStatus(value.lastValidationStatus)
  );
}

function isTogetherConnectionTestResult(
  value: unknown
): value is ITogetherConnectionTestResult {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.success === 'boolean' && typeof value.message === 'string'
  );
}

interface ISaveRouteResponse {
  success: true;
  togetherConnection: ITogetherProviderConnection;
  message?: string;
}

interface ITestRouteResponse {
  result: ITogetherConnectionTestResult;
  togetherConnection: ITogetherProviderConnection;
  message?: string;
}

function isValidSaveResponse(value: unknown): value is ISaveRouteResponse {
  if (!isRecord(value)) {
    return false;
  }

  return value.success === true && isTogetherProviderConnection(value.togetherConnection);
}

function isValidTestResponse(value: unknown): value is ITestRouteResponse {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isTogetherConnectionTestResult(value.result) &&
    isTogetherProviderConnection(value.togetherConnection)
  );
}

function getRouteErrorMessage(payload: unknown, fallback: string): string {
  if (isRecord(payload) && typeof payload.message === 'string') {
    return payload.message;
  }

  return fallback;
}

function formatDate(value?: string): string {
  if (!value) {
    return '—';
  }

  return new Date(value).toLocaleString();
}

export function TogetherSettingsForm({
  togetherConnection: initialTogetherConnection,
  encryptionConfigured,
}: ITogetherSettingsFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [togetherConnection, setTogetherConnection] = useState(
    initialTogetherConnection
  );
  const [notice, setNotice] = useState<NoticeState>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  const form = useForm<ITogetherSettingsFormValues>({
    resolver: zodResolver(togetherSettingsFormSchema),
    defaultValues: getTogetherSettingsDefaultValues(initialTogetherConnection),
  });

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = form;

  const defaultModelValue = useWatch({ control, name: 'defaultModel' }) ?? '';
  const defaultVisionModelValue =
    useWatch({ control, name: 'defaultVisionModel' }) ?? '';
  const defaultImageModelValue =
    useWatch({ control, name: 'defaultImageModel' }) ?? '';
  const availableModels = togetherConnection.availableModels ?? [];
  const hasModelCatalog = availableModels.length > 0;

  const handleSave = async (values: ITogetherSettingsFormValues) => {
    setNotice(null);

    if (hasModelCatalog) {
      if (
        !isModelInCatalogForModality(availableModels, values.defaultModel, 'text')
      ) {
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
      const response = await fetch('/api/model-settings/together', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(normalizeTogetherSettingsSubmitPayload(values)),
      });

      if (isAdminUnauthorizedResponse(response)) {
        setNotice({
          type: 'error',
          message: 'Your session has expired. Redirecting to sign in…',
        });
        redirectToAdminLogin(router, pathname);
        return;
      }

      const payload: unknown = await response.json();

      if (!response.ok || !isValidSaveResponse(payload)) {
        throw new Error(
          getRouteErrorMessage(payload, 'Failed to save Together settings.')
        );
      }

      setTogetherConnection(payload.togetherConnection);
      reset(getTogetherSettingsDefaultValues(payload.togetherConnection));
      setNotice({
        type: 'success',
        message: 'Together settings saved.',
      });
      router.refresh();
    } catch (error) {
      setNotice({
        type: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to save Together settings.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    setNotice(null);
    setIsTesting(true);

    try {
      const response = await fetch('/api/model-settings/together/test', {
        method: 'POST',
      });

      if (isAdminUnauthorizedResponse(response)) {
        setNotice({
          type: 'error',
          message: 'Your session has expired. Redirecting to sign in…',
        });
        redirectToAdminLogin(router, pathname);
        return;
      }

      const payload: unknown = await response.json();

      if (!response.ok || !isValidTestResponse(payload)) {
        throw new Error(
          getRouteErrorMessage(payload, 'Failed to test Together settings.')
        );
      }

      setTogetherConnection(payload.togetherConnection);
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
            : 'Failed to test Together settings.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Together settings</CardTitle>
        <CardDescription>
          Update Together AI connection details used for text, vision, and image
          generation.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {!encryptionConfigured ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            Set <strong>LLM_SETTINGS_ENCRYPTION_KEY</strong> on the admin app
            before saving Together credentials.
          </div>
        ) : null}

        <form className="space-y-4" onSubmit={handleSubmit(handleSave)}>
          <div className="space-y-2">
            <Label htmlFor="together-base-url">Base URL</Label>
            <Input
              id="together-base-url"
              placeholder="https://api.together.ai/v1"
              autoComplete="off"
              aria-invalid={errors.baseUrl ? 'true' : 'false'}
              control={control}
              name="baseUrl"
            />
            {errors.baseUrl ? (
              <p className="text-sm text-destructive" role="alert">
                {errors.baseUrl.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="together-model">Default text model</Label>
            <ConnectionModelSelect
              control={control}
              name="defaultModel"
              models={availableModels}
              modality="text"
              currentValue={defaultModelValue}
              ariaLabel="Default text model"
            />
            {errors.defaultModel ? (
              <p className="text-sm text-destructive" role="alert">
                {errors.defaultModel.message}
              </p>
            ) : null}
            <p className="text-xs text-muted-foreground">
              Used for quiz, flashcards, documents, chat, and other text generation.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="together-vision-model">Default vision model</Label>
            <ConnectionModelSelect
              control={control}
              name="defaultVisionModel"
              models={availableModels}
              modality="vision"
              currentValue={defaultVisionModelValue}
              ariaLabel="Default vision model"
              allowEmpty
            />
            {errors.defaultVisionModel ? (
              <p className="text-sm text-destructive" role="alert">
                {errors.defaultVisionModel.message}
              </p>
            ) : null}
            <p className="text-xs text-muted-foreground">
              Used for screenshot and image input to text.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="together-image-model">Default image model</Label>
            <ConnectionModelSelect
              control={control}
              name="defaultImageModel"
              models={availableModels}
              modality="image"
              currentValue={defaultImageModelValue}
              ariaLabel="Default image model"
              allowEmpty
            />
            {errors.defaultImageModel ? (
              <p className="text-sm text-destructive" role="alert">
                {errors.defaultImageModel.message}
              </p>
            ) : null}
            <p className="text-xs text-muted-foreground">
              Used for slide deck image generation (text to image).
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="together-api-key">API key</Label>
            <Input
              id="together-api-key"
              type="password"
              placeholder={
                togetherConnection.apiKeyConfigured
                  ? 'Leave blank to keep the current key'
                  : 'Paste Together API key'
              }
              autoComplete="new-password"
              aria-invalid={errors.apiKey ? 'true' : 'false'}
              control={control}
              name="apiKey"
            />
            {errors.apiKey ? (
              <p className="text-sm text-destructive" role="alert">
                {errors.apiKey.message}
              </p>
            ) : null}
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
              {isSaving ? 'Saving…' : 'Save Together settings'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleTest}
              disabled={
                isTesting ||
                !encryptionConfigured ||
                !togetherConnection.apiKeyConfigured
              }
            >
              {isTesting ? 'Testing…' : 'Test saved connection'}
            </Button>
          </div>
        </form>

        <div className="grid gap-3 text-sm sm:grid-cols-3">
          <div className="rounded-lg border border-border p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Last updated
            </p>
            <p className="mt-2">{formatDate(togetherConnection.updatedAt)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              by {togetherConnection.updatedBy || '—'}
            </p>
          </div>
          <div className="rounded-lg border border-border p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Last validation
            </p>
            <p className="mt-2">{formatDate(togetherConnection.lastValidatedAt)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {togetherConnection.lastValidationError || 'No validation error recorded.'}
            </p>
          </div>
          <div className="rounded-lg border border-border p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Model catalog
            </p>
            <p className="mt-2">
              {formatModelsSyncedAt(togetherConnection.modelsSyncedAt)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {availableModels.length > 0
                ? `${availableModels.length} models uploaded`
                : 'Test or save with credentials to sync models.'}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
