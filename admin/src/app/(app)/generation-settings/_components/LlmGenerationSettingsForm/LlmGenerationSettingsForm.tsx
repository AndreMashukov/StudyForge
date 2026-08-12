'use client';

import type {
  ILlmGenerationSettings,
  LlmGenerationFlowId,
} from '@shared-types';
import { zodResolver } from '@hookform/resolvers/zod';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm, type Control, type FieldPath } from 'react-hook-form';
import {
  isAdminUnauthorizedResponse,
  redirectToAdminLogin,
} from '@admin/auth/client-login-redirect';
import { saveLlmGenerationSettings } from '@admin/mutations/llm-generation-settings';
import { Button } from '@admin/components/ui/Button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@admin/components/ui/Card';
import { Checkbox } from '@admin/components/ui/Checkbox';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@admin/components/ui/Form';
import { Input } from '@admin/components/ui/Input';
import {
  getLlmGenerationSettingsDefaultValues,
  LLM_GENERATION_FLOW_METADATA,
  llmGenerationSettingsFormSchema,
  normalizeLlmGenerationSettingsSubmitPayload,
  type ILlmGenerationSettingsFormValues,
} from './LlmGenerationSettingsForm.form';

interface INoticeState {
  type: 'success' | 'error';
  message: string;
}

interface ISaveLlmGenerationSettingsResponse {
  success: true;
  settings: ILlmGenerationSettings;
}

type GlobalNumericFieldName =
  | 'requestTimeoutMs'
  | 'maxOutputTokens'
  | 'temperature'
  | 'topK'
  | 'topP'
  | 'thinkingBudget';

type StepNumericFieldName =
  | 'maxOutputTokens'
  | 'temperature'
  | 'thinkingBudget';

interface INumericFieldConfig<TName extends string> {
  name: TName;
  label: string;
  description: string;
  min: number;
  max: number;
  step: number;
}

interface INumericSettingFieldProps {
  control: Control<ILlmGenerationSettingsFormValues>;
  field: INumericFieldConfig<string>;
  name: FieldPath<ILlmGenerationSettingsFormValues>;
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
      typeof value.thinkingBudget === 'number') &&
    (value.flows === undefined || typeof value.flows === 'object')
  );
}

function isSaveResponse(
  value: unknown,
): value is ISaveLlmGenerationSettingsResponse {
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
  field,
  name,
}: INumericSettingFieldProps) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field: controllerField }) => (
        <FormItem>
          <FormLabel>{field.label}</FormLabel>
          <FormControl>
            <Input
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
          </FormControl>
          <FormDescription>{field.description}</FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

const requestFields: INumericFieldConfig<GlobalNumericFieldName>[] = [
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
      'Default completion budget when a generation step does not specify its own token limit.',
    min: 1,
    max: 65_536,
    step: 1,
  },
];

const globalSamplingFields: INumericFieldConfig<GlobalNumericFieldName>[] = [
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

const globalReasoningFields: INumericFieldConfig<GlobalNumericFieldName>[] = [
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

const stepOutputField: INumericFieldConfig<StepNumericFieldName> = {
  name: 'maxOutputTokens',
  label: 'Max output tokens',
  description: 'Completion budget for this generation step.',
  min: 1,
  max: 65_536,
  step: 1,
};

const stepTemperatureField: INumericFieldConfig<StepNumericFieldName> = {
  name: 'temperature',
  label: 'Temperature',
  description:
    'Sampling temperature for this step. Lower is more deterministic.',
  min: 0,
  max: 2,
  step: 0.05,
};

const stepThinkingField: INumericFieldConfig<StepNumericFieldName> = {
  name: 'thinkingBudget',
  label: 'Thinking budget',
  description:
    'Optional Gemini thinking token budget for this step. Leave blank for provider defaults.',
  min: 0,
  max: 65_536,
  step: 1,
};

function GenerationStepSection({
  control,
  flowId,
}: {
  control: Control<ILlmGenerationSettingsFormValues>;
  flowId: LlmGenerationFlowId;
}) {
  const metadata = LLM_GENERATION_FLOW_METADATA.find(
    (entry) => entry.id === flowId,
  );

  if (!metadata) {
    return null;
  }

  return (
    <section className="space-y-4 rounded-lg border border-border p-4">
      <div>
        <h3 className="text-sm font-medium">{metadata.label}</h3>
        <p className="text-sm text-muted-foreground">{metadata.description}</p>
        <p className="mt-2 text-xs text-muted-foreground">id: {metadata.id}</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <NumericSettingField
          control={control}
          field={stepOutputField}
          name={`flows.${flowId}.maxOutputTokens`}
        />
        <NumericSettingField
          control={control}
          field={stepTemperatureField}
          name={`flows.${flowId}.temperature`}
        />
        <NumericSettingField
          control={control}
          field={stepThinkingField}
          name={`flows.${flowId}.thinkingBudget`}
        />
      </div>

      <FormField
        control={control}
        name={`flows.${flowId}.disableReasoning`}
        render={({ field }) => (
          <FormItem>
            <div className="flex items-center gap-2">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onBlur={field.onBlur}
                  onChange={(event) => field.onChange(event.target.checked)}
                />
              </FormControl>
              <FormLabel className="text-sm font-normal">
                Disable reasoning for this step
              </FormLabel>
            </div>
            <FormMessage />
          </FormItem>
        )}
      />
    </section>
  );
}

export function LlmGenerationSettingsForm({
  settings,
}: ILlmGenerationSettingsFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [notice, setNotice] = useState<INoticeState | null>(null);
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
        <CardTitle className="text-xl">LLM generation settings</CardTitle>
        <CardDescription>
          Configure global defaults and per-step budgets. Call sites select a
          generation step; values resolve as step override, then code seed, then
          global.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form className="space-y-8" onSubmit={handleSubmit}>
            <section className="space-y-4">
              <div>
                <h3 className="text-sm font-medium">Global defaults</h3>
                <p className="text-sm text-muted-foreground">
                  Base values used when a generation step does not override
                  them, and for call sites that only use a code profile.
                </p>
              </div>
              <div className="grid gap-6 md:grid-cols-2">
                {requestFields.map((field) => (
                  <NumericSettingField
                    key={field.name}
                    control={form.control}
                    field={field}
                    name={field.name}
                  />
                ))}
              </div>
              <div className="grid gap-6 md:grid-cols-3">
                {globalSamplingFields.map((field) => (
                  <NumericSettingField
                    key={field.name}
                    control={form.control}
                    field={field}
                    name={field.name}
                  />
                ))}
              </div>
              <FormField
                control={form.control}
                name="disableReasoning"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center gap-2">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onBlur={field.onBlur}
                          onChange={(event) =>
                            field.onChange(event.target.checked)
                          }
                        />
                      </FormControl>
                      <FormLabel className="text-sm font-normal">
                        Disable reasoning by default
                      </FormLabel>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid gap-6 md:grid-cols-2">
                {globalReasoningFields.map((field) => (
                  <NumericSettingField
                    key={field.name}
                    control={form.control}
                    field={field}
                    name={field.name}
                  />
                ))}
              </div>
            </section>

            <section className="space-y-4">
              <div>
                <h3 className="text-sm font-medium">Generation steps</h3>
                <p className="text-sm text-muted-foreground">
                  Step-level budgets for sequence quiz, diagram quiz phases,
                  flashcards, screenshots, and related helpers. Override without
                  redeploying functions.
                </p>
              </div>
              <div className="space-y-6">
                {LLM_GENERATION_FLOW_METADATA.map((flow) => (
                  <GenerationStepSection
                    key={flow.id}
                    control={form.control}
                    flowId={flow.id}
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
                role={notice.type === 'success' ? 'status' : 'alert'}
                aria-live={notice.type === 'success' ? 'polite' : 'assertive'}
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
        </Form>
      </CardContent>
    </Card>
  );
}
