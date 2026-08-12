'use client';

import type {
  ILlmGenerationSettings,
  LlmGenerationFlowId,
  LlmGenerationProfileId,
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
  LLM_GENERATION_PROFILE_METADATA,
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

type ProfileNumericFieldName =
  | 'maxOutputTokens'
  | 'temperature'
  | 'topK'
  | 'topP'
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
      'Default completion budget when a generation flow does not specify its own token limit.',
    min: 1,
    max: 65_536,
    step: 1,
  },
];

const profileSamplingFields: INumericFieldConfig<ProfileNumericFieldName>[] = [
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

const profileOutputField: INumericFieldConfig<ProfileNumericFieldName> = {
  name: 'maxOutputTokens',
  label: 'Max output tokens',
  description: 'Completion budget for flows that use this profile.',
  min: 1,
  max: 65_536,
  step: 1,
};

const profileReasoningFields: INumericFieldConfig<ProfileNumericFieldName>[] = [
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

function ProfileSettingsSection({
  control,
  profileId,
}: {
  control: Control<ILlmGenerationSettingsFormValues>;
  profileId: LlmGenerationProfileId;
}) {
  const metadata = LLM_GENERATION_PROFILE_METADATA.find(
    (entry) => entry.id === profileId,
  );

  if (!metadata) {
    return null;
  }

  return (
    <section className="space-y-4 rounded-lg border border-border p-4">
      <div>
        <h3 className="text-sm font-medium">{metadata.label}</h3>
        <p className="text-sm text-muted-foreground">{metadata.description}</p>
        <p className="mt-2 text-xs text-muted-foreground">
          Used by: {metadata.flows.join(', ')}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <NumericSettingField
          control={control}
          field={profileOutputField}
          name={`profiles.${profileId}.maxOutputTokens`}
        />
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {profileSamplingFields.map((field) => (
          <NumericSettingField
            key={field.name}
            control={control}
            field={field}
            name={`profiles.${profileId}.${field.name}`}
          />
        ))}
      </div>

      <FormField
        control={control}
        name={`profiles.${profileId}.disableReasoning`}
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
                Disable reasoning for this profile
              </FormLabel>
            </div>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="grid gap-6 md:grid-cols-2">
        {profileReasoningFields.map((field) => (
          <NumericSettingField
            key={field.name}
            control={control}
            field={field}
            name={`profiles.${profileId}.${field.name}`}
          />
        ))}
      </div>
    </section>
  );
}

function FlowSettingsSection({
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
        <p className="mt-2 text-xs text-muted-foreground">
          Inherits profile: {metadata.profileId} · id: {metadata.id}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <NumericSettingField
          control={control}
          field={profileOutputField}
          name={`flows.${flowId}.maxOutputTokens`}
        />
        <NumericSettingField
          control={control}
          field={profileReasoningFields[0]}
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
                Disable reasoning for this flow
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
        <CardTitle className="text-xl">Global LLM runtime settings</CardTitle>
        <CardDescription>
          Configure platform-wide defaults, named sampling profiles, and
          per-flow token budgets. Call sites select a flow id; values resolve
          as flow, then profile, then global.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form className="space-y-8" onSubmit={handleSubmit}>
            <section className="space-y-4">
              <div>
                <h3 className="text-sm font-medium">Global defaults</h3>
                <p className="text-sm text-muted-foreground">
                  Base values inherited by every profile unless a profile
                  overrides them.
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
                <h3 className="text-sm font-medium">Named profiles</h3>
                <p className="text-sm text-muted-foreground">
                  Generation flows pick one of these profiles at runtime.
                </p>
              </div>
              <div className="space-y-6">
                {LLM_GENERATION_PROFILE_METADATA.map((profile) => (
                  <ProfileSettingsSection
                    key={profile.id}
                    control={form.control}
                    profileId={profile.id}
                  />
                ))}
              </div>
            </section>

            <section className="space-y-4">
              <div>
                <h3 className="text-sm font-medium">Flow presets</h3>
                <p className="text-sm text-muted-foreground">
                  Step-level budgets for sequence quiz, diagram quiz phases,
                  flashcards, screenshots, and related helpers. Override without
                  redeploying functions.
                </p>
              </div>
              <div className="space-y-6">
                {LLM_GENERATION_FLOW_METADATA.map((flow) => (
                  <FlowSettingsSection
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
