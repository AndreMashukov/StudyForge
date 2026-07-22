'use client';

import type {
  IOpenRouterConnectionTestResult,
  IOpenRouterProviderConnection,
} from '@shared-types';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Label } from '@study-forge/ui';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  isAdminUnauthorizedResponse,
  redirectToAdminLogin,
} from '../../../lib/auth/client-login-redirect';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../ui/Card';
import { Input } from '../../ui/Input';
import {
  getOpenRouterSettingsDefaultValues,
  normalizeOpenRouterSettingsSubmitPayload,
  openRouterSettingsFormSchema,
  type IOpenRouterSettingsFormValues,
} from './OpenRouterSettingsForm.form';

type NoticeState =
  | {
      type: 'success' | 'error';
      message: string;
    }
  | null;

export interface IOpenRouterSettingsFormProps {
  openRouterConnection: IOpenRouterProviderConnection;
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

function isOpenRouterProviderConnection(
  value: unknown
): value is IOpenRouterProviderConnection {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.providerKind === 'openrouter' &&
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

function isOpenRouterConnectionTestResult(
  value: unknown
): value is IOpenRouterConnectionTestResult {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.success === 'boolean' && typeof value.message === 'string'
  );
}

interface ISaveRouteResponse {
  success: true;
  openRouterConnection: IOpenRouterProviderConnection;
  message?: string;
}

interface ITestRouteResponse {
  result: IOpenRouterConnectionTestResult;
  openRouterConnection: IOpenRouterProviderConnection;
  message?: string;
}

function isValidSaveResponse(value: unknown): value is ISaveRouteResponse {
  if (!isRecord(value)) {
    return false;
  }

  return value.success === true && isOpenRouterProviderConnection(value.openRouterConnection);
}

function isValidTestResponse(value: unknown): value is ITestRouteResponse {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isOpenRouterConnectionTestResult(value.result) &&
    isOpenRouterProviderConnection(value.openRouterConnection)
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

export function OpenRouterSettingsForm({
  openRouterConnection: initialOpenRouterConnection,
  encryptionConfigured,
}: IOpenRouterSettingsFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [openRouterConnection, setOpenRouterConnection] = useState(
    initialOpenRouterConnection
  );
  const [notice, setNotice] = useState<NoticeState>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  const form = useForm<IOpenRouterSettingsFormValues>({
    resolver: zodResolver(openRouterSettingsFormSchema),
    defaultValues: getOpenRouterSettingsDefaultValues(initialOpenRouterConnection),
  });

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = form;

  const handleSave = async (values: IOpenRouterSettingsFormValues) => {
    setNotice(null);
    setIsSaving(true);

    try {
      const response = await fetch('/api/model-settings/openrouter', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(normalizeOpenRouterSettingsSubmitPayload(values)),
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
          getRouteErrorMessage(payload, 'Failed to save OpenRouter settings.')
        );
      }

      setOpenRouterConnection(payload.openRouterConnection);
      reset(getOpenRouterSettingsDefaultValues(payload.openRouterConnection));
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

  const handleTest = async () => {
    setNotice(null);
    setIsTesting(true);

    try {
      const response = await fetch('/api/model-settings/openrouter/test', {
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
          getRouteErrorMessage(payload, 'Failed to test OpenRouter settings.')
        );
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
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">OpenRouter settings</CardTitle>
        <CardDescription>
          Update OpenRouter connection details. Provider activation is managed from
          the model settings overview page.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {!encryptionConfigured ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            Set <strong>LLM_SETTINGS_ENCRYPTION_KEY</strong> on the admin app
            before saving OpenRouter credentials.
          </div>
        ) : null}

        <form className="space-y-4" onSubmit={handleSubmit(handleSave)}>
          <div className="space-y-2">
            <Label htmlFor="openrouter-base-url">Base URL</Label>
            <Input
              id="openrouter-base-url"
              placeholder="https://openrouter.ai/api/v1"
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
            <Label htmlFor="openrouter-model">Default text model</Label>
            <Input
              id="openrouter-model"
              placeholder="anthropic/claude-sonnet-4.6"
              autoComplete="off"
              aria-invalid={errors.defaultModel ? 'true' : 'false'}
              control={control}
              name="defaultModel"
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
            <Label htmlFor="openrouter-vision-model">Default vision model</Label>
            <Input
              id="openrouter-vision-model"
              placeholder="google/gemini-2.5-flash"
              autoComplete="off"
              aria-invalid={errors.defaultVisionModel ? 'true' : 'false'}
              control={control}
              name="defaultVisionModel"
            />
            {errors.defaultVisionModel ? (
              <p className="text-sm text-destructive" role="alert">
                {errors.defaultVisionModel.message}
              </p>
            ) : null}
            <p className="text-xs text-muted-foreground">
              Used for screenshot and image input to text. Leave empty to use Gemini for
              screenshots.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="openrouter-image-model">Default image model</Label>
            <Input
              id="openrouter-image-model"
              placeholder="google/gemini-3.1-flash-image-preview"
              autoComplete="off"
              aria-invalid={errors.defaultImageModel ? 'true' : 'false'}
              control={control}
              name="defaultImageModel"
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
            <Label htmlFor="openrouter-api-key">API key</Label>
            <Input
              id="openrouter-api-key"
              type="password"
              placeholder={
                openRouterConnection.apiKeyConfigured
                  ? 'Leave blank to keep the current key'
                  : 'Paste OpenRouter API key'
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
  );
}
