'use client';

import type { ILlmGenerationSettings } from '@shared-types';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Label } from '@study-forge/ui';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  Controller,
  useForm,
  type Control,
  type FieldErrors,
} from 'react-hook-form';
import {
  isAdminUnauthorizedResponse,
  redirectToAdminLogin,
} from '@admin/auth/client-login-redirect';
import { saveLlmGenerationSettings } from '@admin/mutations/llm-generation-settings';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@admin/components/ui/Card';
import { Input } from '@admin/components/ui/Input';
import {
  getLlmGenerationSettingsDefaultValues,
  llmGenerationSettingsFormSchema,
  normalizeLlmGenerationSettingsSubmitPayload,
  type ILlmGenerationSettingsFormValues,
} from './LlmGenerationSettingsForm.form';

type NoticeState = {
  type: 'success' | 'error';
  message: string;
} | null;

type NumericFieldName =
  | 'requestTimeoutMs'
  | 'maxOutputTokens'
  | 'temperature'
  | 'topK'
  | 'topP'
  | 'thinkingBudget';

interface INumericFieldConfig {
  name: NumericFieldName;
  label: string;
  description: string;
  min: number;
  max: number;
  step: number;
}

export interface ILlmGenerationSettingsFormProps {
  settings: ILlmGenerationSettings;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isLlmGenerationSettings(
  value: unknown,
): value is ILlmGenerationSettings {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.requestTimeoutMs === 'number' &&
    typeof value.maxOutputTokens === 'number' &&
    typeof value.temperature === 'number' &&
    typeof value.topK === 'number' &&
    typeof value.topP === 'number' &&
    typeof value.disableReasoning === 'boolean' &&
    (value.thinkingBudget === undefined ||
      typeof value.thinkingBudget === 'number')
  );
}

function isSaveResponse(
  value: unknown,
): value is { success: true; settings: ILlmGenerationSettings } {
  return (
    isRecord(value) &&
    value.success === true &&
    isLlmGenerationSettings(value.settings)
  );
}

function getRouteErrorMessage(payload: unknown): string {
  if (isRecord(payload) && typeof payload.message === 'string') {
    return payload.message;
  }

  return 'Failed to save LLM generation settings.';
}

function NumericSettingField({
  control,
  errors,
  field,
}: {
  control: Control<ILlmGenerationSettingsFormValues>;
  errors: FieldErrors<ILlmGenerationSettingsFormValues>;
  field: INumericFieldConfig;
}) {
  const errorMessage = errors[field.name]?.message;

  return (
    <div className="space-y-2">
      <Label htmlFor={field.name}>{field.label}</Label>
      <Controller
        control={control}
        name={field.name}
        render={({ field: controllerField }) => (
          <Input
            id={field.name}
            type="number"
            min={field.min}
            max={field.max}
            step={field.step}
            value={
              typeof controllerField.value === 'number'
                ? controllerField.value
                : ''
            }
            onBlur={controllerField.onBlur}
            onChange={(event) => {
              if (event.currentTarget.value === '') {
                controllerField.onChange(undefined);
                return;
              }

              controllerField.onChange(event.currentTarget.valueAsNumber);
            }}
          />
        )}
      />
      <p className="text-xs text-muted-foreground">{field.description}</p>
      {errorMessage ? (
        <p className="text-xs text-destructive">{String(errorMessage)}</p>
      ) : null}
    </div>
  );
}

const requestFields: INumericFieldConfig[] = [
  {
    name: 'requestTimeoutMs',
    label: 'Provider request timeout (ms)',
    description:
      'Deadline for individual provider HTTP requests. Firebase function deadlines are configured separately at deploy time.',
    min: 5_000,
    max: 540_000,
    step: 1_000,
  },
  {
    name: 'maxOutputTokens',
    label: 'Max output tokens',
    description:
      'Default completion budget when a generation flow does not specify its own token limit.',
    min: 1,
    max: 65_536,
    step: 1,
  },
];

const samplingFields: INumericFieldConfig[] = [
  {
    name: 'temperature',
    label: 'Temperature',
    description:
      'Lower values are more deterministic; higher values are more varied.',
    min: 0,
    max: 2,
    step: 0.05,
  },
  {
    name: 'topK',
    label: 'Top K',
    description: 'Limits sampling to the most likely tokens when supported.',
    min: 1,
    max: 100,
    step: 1,
  },
  {
    name: 'topP',
    label: 'Top P',
    description: 'Nucleus sampling probability mass when supported.',
    min: 0,
    max: 1,
    step: 0.01,
  },
];

const reasoningFields: INumericFieldConfig[] = [
  {
    name: 'thinkingBudget',
    label: 'Thinking budget',
    description:
      'Optional Gemini thinking token budget. Leave blank to use provider/model defaults unless reasoning is disabled.',
    min: 0,
    max: 65_536,
    step: 1,
  },
];

export function LlmGenerationSettingsForm({
  settings,
}: ILlmGenerationSettingsFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [notice, setNotice] = useState<NoticeState>(null);
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<ILlmGenerationSettingsFormValues>({
    resolver: zodResolver(llmGenerationSettingsFormSchema),
    defaultValues: getLlmGenerationSettingsDefaultValues(settings),
  });

  const handleSubmit = form.handleSubmit(async (values) => {
    setNotice(null);
    setIsSaving(true);

    try {
      const payload = normalizeLlmGenerationSettingsSubmitPayload(values);
      const { response, payload: result } =
        await saveLlmGenerationSettings(payload);

      if (isAdminUnauthorizedResponse(response)) {
        redirectToAdminLogin(router, pathname);
        return;
      }

      if (!response.ok || !isSaveResponse(result)) {
        throw new Error(getRouteErrorMessage(result));
      }

      form.reset(getLlmGenerationSettingsDefaultValues(result.settings));
      setNotice({
        type: 'success',
        message: 'LLM generation settings saved.',
      });
      router.refresh();
    } catch (error) {
      setNotice({
        type: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to save LLM generation settings.',
      });
    } finally {
      setIsSaving(false);
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Global LLM runtime settings</CardTitle>
        <CardDescription>
          Configure platform-wide defaults for provider calls. Generation flows
          with explicit safety-tuned values can still override these defaults.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-8" onSubmit={handleSubmit}>
          <section className="space-y-4">
            <div>
              <h3 className="text-sm font-medium">Request limits</h3>
              <p className="text-sm text-muted-foreground">
                These values affect runtime provider requests, not deployed
                Firebase function deadlines.
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              {requestFields.map((field) => (
                <NumericSettingField
                  key={field.name}
                  control={form.control}
                  errors={form.formState.errors}
                  field={field}
                />
              ))}
            </div>
          </section>

          <section className="space-y-4">
            <div>
              <h3 className="text-sm font-medium">Sampling defaults</h3>
              <p className="text-sm text-muted-foreground">
                Used when a generation path does not provide a more specific
                sampling configuration.
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              {samplingFields.map((field) => (
                <NumericSettingField
                  key={field.name}
                  control={form.control}
                  errors={form.formState.errors}
                  field={field}
                />
              ))}
            </div>
          </section>

          <section className="space-y-4">
            <div>
              <h3 className="text-sm font-medium">Reasoning defaults</h3>
              <p className="text-sm text-muted-foreground">
                Reasoning controls map to provider-specific thinking options
                when supported.
              </p>
            </div>
            <Controller
              control={form.control}
              name="disableReasoning"
              render={({ field }) => (
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={field.value}
                    onBlur={field.onBlur}
                    onChange={(event) => field.onChange(event.target.checked)}
                    className="h-4 w-4 rounded border-border"
                  />
                  Disable reasoning by default
                </label>
              )}
            />
            <div className="grid gap-6 md:grid-cols-2">
              {reasoningFields.map((field) => (
                <NumericSettingField
                  key={field.name}
                  control={form.control}
                  errors={form.formState.errors}
                  field={field}
                />
              ))}
            </div>
          </section>

          {notice ? (
            <p
              className={
                notice.type === 'success'
                  ? 'text-sm text-accent'
                  : 'text-sm text-destructive'
              }
            >
              {notice.message}
            </p>
          ) : null}

          <div className="flex justify-end">
            <Button type="submit" disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save generation settings'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
