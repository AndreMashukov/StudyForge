'use client';

import type {
  IMiniMaxConnectionTestResult,
  IMiniMaxProviderConnection,
} from '@shared-types';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Input, Label } from '@study-forge/ui';
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
import {
  getMiniMaxSettingsDefaultValues,
  miniMaxSettingsFormSchema,
  normalizeMiniMaxSettingsSubmitPayload,
  type IMiniMaxSettingsFormValues,
} from './MiniMaxSettingsForm.form';

type NoticeState =
  | {
      type: 'success' | 'error';
      message: string;
    }
  | null;

export interface IMiniMaxSettingsFormProps {
  miniMaxConnection: IMiniMaxProviderConnection;
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

function isMiniMaxProviderConnection(
  value: unknown
): value is IMiniMaxProviderConnection {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.providerType === 'minimax' &&
    typeof value.label === 'string' &&
    typeof value.enabled === 'boolean' &&
    value.credentialMode === 'encrypted-firestore' &&
    typeof value.apiKeyConfigured === 'boolean' &&
    typeof value.baseUrl === 'string' &&
    typeof value.defaultModel === 'string' &&
    typeof value.imageGenerationUrl === 'string' &&
    isOptionalString(value.defaultVisionModel) &&
    isOptionalString(value.defaultImageModel) &&
    isOptionalString(value.updatedAt) &&
    isOptionalString(value.updatedBy) &&
    isOptionalString(value.lastValidatedAt) &&
    isOptionalStringOrNull(value.lastValidationError) &&
    isOptionalValidationStatus(value.lastValidationStatus)
  );
}

function isMiniMaxConnectionTestResult(
  value: unknown
): value is IMiniMaxConnectionTestResult {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.success === 'boolean' && typeof value.message === 'string'
  );
}

interface ISaveRouteResponse {
  success: true;
  miniMaxConnection: IMiniMaxProviderConnection;
  message?: string;
}

interface ITestRouteResponse {
  result: IMiniMaxConnectionTestResult;
  miniMaxConnection: IMiniMaxProviderConnection;
  message?: string;
}

function isValidSaveResponse(value: unknown): value is ISaveRouteResponse {
  if (!isRecord(value)) {
    return false;
  }

  return value.success === true && isMiniMaxProviderConnection(value.miniMaxConnection);
}

function isValidTestResponse(value: unknown): value is ITestRouteResponse {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isMiniMaxConnectionTestResult(value.result) &&
    isMiniMaxProviderConnection(value.miniMaxConnection)
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

export function MiniMaxSettingsForm({
  miniMaxConnection: initialMiniMaxConnection,
  encryptionConfigured,
}: IMiniMaxSettingsFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [miniMaxConnection, setMiniMaxConnection] = useState(
    initialMiniMaxConnection
  );
  const [notice, setNotice] = useState<NoticeState>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  const form = useForm<IMiniMaxSettingsFormValues>({
    resolver: zodResolver(miniMaxSettingsFormSchema),
    defaultValues: getMiniMaxSettingsDefaultValues(initialMiniMaxConnection),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = form;

  const handleSave = async (values: IMiniMaxSettingsFormValues) => {
    setNotice(null);
    setIsSaving(true);

    try {
      const response = await fetch('/api/model-settings/minimax', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(normalizeMiniMaxSettingsSubmitPayload(values)),
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
          getRouteErrorMessage(payload, 'Failed to save MiniMax settings.')
        );
      }

      setMiniMaxConnection(payload.miniMaxConnection);
      reset(getMiniMaxSettingsDefaultValues(payload.miniMaxConnection));
      setNotice({
        type: 'success',
        message: 'MiniMax settings saved.',
      });
      router.refresh();
    } catch (error) {
      setNotice({
        type: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to save MiniMax settings.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    setNotice(null);
    setIsTesting(true);

    try {
      const response = await fetch('/api/model-settings/minimax/test', {
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
          getRouteErrorMessage(payload, 'Failed to test MiniMax settings.')
        );
      }

      setMiniMaxConnection(payload.miniMaxConnection);
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
            : 'Failed to test MiniMax settings.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">MiniMax settings</CardTitle>
        <CardDescription>
          Update MiniMax connection details. Provider activation is managed from
          the model settings overview page.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {!encryptionConfigured ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            Set <strong>LLM_SETTINGS_ENCRYPTION_KEY</strong> on the admin app
            before saving MiniMax credentials.
          </div>
        ) : null}

        <form className="space-y-4" onSubmit={handleSubmit(handleSave)}>
          <div className="space-y-2">
            <Label htmlFor="minimax-base-url">Base URL</Label>
            <Input
              id="minimax-base-url"
              placeholder="https://api.minimax.io/v1"
              autoComplete="off"
              aria-invalid={errors.baseUrl ? 'true' : 'false'}
              {...register('baseUrl')}
            />
            {errors.baseUrl ? (
              <p className="text-sm text-destructive" role="alert">
                {errors.baseUrl.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="minimax-model">Default text model</Label>
            <Input
              id="minimax-model"
              placeholder="MiniMax-M3"
              autoComplete="off"
              aria-invalid={errors.defaultModel ? 'true' : 'false'}
              {...register('defaultModel')}
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
            <Label htmlFor="minimax-vision-model">Default vision model</Label>
            <Input
              id="minimax-vision-model"
              placeholder="MiniMax-M3"
              autoComplete="off"
              aria-invalid={errors.defaultVisionModel ? 'true' : 'false'}
              {...register('defaultVisionModel')}
            />
            {errors.defaultVisionModel ? (
              <p className="text-sm text-destructive" role="alert">
                {errors.defaultVisionModel.message}
              </p>
            ) : null}
            <p className="text-xs text-muted-foreground">
              Used for screenshot and image input to text via OpenAI-compatible chat.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="minimax-image-model">Default image model</Label>
            <Input
              id="minimax-image-model"
              placeholder="image-01"
              autoComplete="off"
              aria-invalid={errors.defaultImageModel ? 'true' : 'false'}
              {...register('defaultImageModel')}
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
            <Label htmlFor="minimax-image-url">Image generation URL</Label>
            <Input
              id="minimax-image-url"
              placeholder="https://api.minimax.io/v1/image_generation"
              autoComplete="off"
              aria-invalid={errors.imageGenerationUrl ? 'true' : 'false'}
              {...register('imageGenerationUrl')}
            />
            {errors.imageGenerationUrl ? (
              <p className="text-sm text-destructive" role="alert">
                {errors.imageGenerationUrl.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="minimax-api-key">API key</Label>
            <Input
              id="minimax-api-key"
              type="password"
              placeholder={
                miniMaxConnection.apiKeyConfigured
                  ? 'Leave blank to keep the current key'
                  : 'Paste MiniMax API key'
              }
              autoComplete="new-password"
              aria-invalid={errors.apiKey ? 'true' : 'false'}
              {...register('apiKey')}
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
              {isSaving ? 'Saving…' : 'Save MiniMax settings'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={handleTest}
              disabled={
                isTesting ||
                !encryptionConfigured ||
                !miniMaxConnection.apiKeyConfigured
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
            <p className="mt-2">{formatDate(miniMaxConnection.updatedAt)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              by {miniMaxConnection.updatedBy || '—'}
            </p>
          </div>
          <div className="rounded-lg border border-border p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Last validation
            </p>
            <p className="mt-2">{formatDate(miniMaxConnection.lastValidatedAt)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {miniMaxConnection.lastValidationError || 'No validation error recorded.'}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
