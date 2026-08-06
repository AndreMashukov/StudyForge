'use client';

import type { IProviderConnectionCatalogEntry } from '@shared-types';
import {
  ADMIN_CONFIGURABLE_GENERATION_KINDS,
  GENERATION_KIND_METADATA,
} from '@shared-types';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Label } from '@study-forge/ui';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm, useWatch, type Control, type Path, type UseFormSetValue } from 'react-hook-form';
import {
  isAdminUnauthorizedResponse,
  redirectToAdminLogin,
} from '@admin/auth/client-login-redirect';
import { deleteLlmSetup, saveLlmSetup } from '@admin/mutations/llm-setups';
import {
  filterModelsForModality,
  isModelInCatalogForModality,
} from '@admin/domain/provider-model-catalog/ui';
import { Card, CardContent, CardHeader, CardTitle } from '@admin/components/ui/Card';
import { Input } from '@admin/components/ui/Input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@admin/components/ui/Select';
import { ConnectionModelSelect } from '@admin/components/connections/ConnectionModelSelect';
import {
  type ILlmSetupFormValues,
  filterConnectionsForModality,
  getGenerationKindGroups,
  getSupportedWorkflowOptions,
  getWorkflowHelpText,
  formatWorkflowOptionLabel,
  type IAdminConfigurableGenerationKind,
  isWorkflowOptionDisabled,
  llmSetupFormSchema,
  parseWorkflowValue,
  toGenerationRoutes,
} from './LlmSetupForm.form';

export type { ILlmSetupFormValues } from './LlmSetupForm.form';

export interface ILlmSetupFormProps {
  setupId?: string;
  defaultValues: ILlmSetupFormValues;
  providerConnections: IProviderConnectionCatalogEntry[];
  providerWarnings?: string[];
}

function defaultModelForConnection(
  connection: IProviderConnectionCatalogEntry | undefined,
  modality: import('@shared-types').LlmModality
): string {
  if (!connection) {
    return '';
  }

  const models = filterModelsForModality(connection.availableModels, modality);
  return models[0]?.id ?? '';
}

function generationRouteField(
  kind: IAdminConfigurableGenerationKind,
  field: 'connectionId' | 'model' | 'workflow'
): Path<ILlmSetupFormValues> {
  return `generationRoutes.${kind}.${field}`;
}

function GenerationKindRow({
  kind,
  connections,
  control,
  setValue,
}: {
  kind: IAdminConfigurableGenerationKind;
  connections: IProviderConnectionCatalogEntry[];
  control: Control<ILlmSetupFormValues>;
  setValue: UseFormSetValue<ILlmSetupFormValues>;
}) {
  const metadata = GENERATION_KIND_METADATA[kind];
  const filteredConnections = filterConnectionsForModality(
    connections,
    metadata.requiredModality
  );
  const workflowOptions = getSupportedWorkflowOptions(kind);
  const workflowHelpText = getWorkflowHelpText(kind);
  const connectionField = generationRouteField(kind, 'connectionId');
  const modelField = generationRouteField(kind, 'model');
  const workflowField = generationRouteField(kind, 'workflow');

  const connectionId = (useWatch({ control, name: connectionField }) ?? '') as string;
  const modelValue = (useWatch({ control, name: modelField }) ?? '') as string;
  const selectedConnection = connections.find(
    (connection) => connection.id === connectionId
  );

  return (
    <tr className="border-b border-border last:border-0">
      <td className="px-3 py-3 align-top">
        <div className="font-medium">{metadata.label}</div>
        <p className="text-xs text-muted-foreground">{metadata.description}</p>
        <p className="mt-1 text-xs text-muted-foreground">Modality: {metadata.requiredModality}</p>
      </td>
      <td className="px-3 py-3 align-top">
        <Select
          control={control}
          name={connectionField}
          onValueChange={(nextConnectionId) => {
            const nextConnection = connections.find(
              (connection) => connection.id === nextConnectionId
            );
            const nextModel = defaultModelForConnection(
              nextConnection,
              metadata.requiredModality
            );
            setValue(modelField, nextModel, { shouldDirty: true, shouldValidate: true });
          }}
        >
          <SelectTrigger aria-label={`${metadata.label} provider connection`}>
            <SelectValue placeholder="Select connection" />
          </SelectTrigger>
          <SelectContent>
            {filteredConnections.map((connection) => (
              <SelectItem key={connection.id} value={connection.id}>
                {connection.label} ({connection.providerKind})
                {!connection.apiKeyConfigured ? ' — missing credentials' : ''}
                {connection.availableModels.length === 0 ? ' — models not synced' : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
      <td className="px-3 py-3 align-top">
        <ConnectionModelSelect
          control={control}
          name={modelField}
          models={selectedConnection?.availableModels ?? []}
          modality={metadata.requiredModality}
          currentValue={modelValue}
          ariaLabel={`${metadata.label} model`}
          emptyHint="Open Provider connections, then Test or Save to sync models."
        />
      </td>
      <td className="px-3 py-3 align-top">
        <Select
          control={control}
          name={workflowField}
          transformValue={parseWorkflowValue}
        >
          <SelectTrigger aria-label={`${metadata.label} workflow`}>
            <SelectValue placeholder="Select workflow" />
          </SelectTrigger>
          <SelectContent>
            {workflowOptions.map((workflow) => (
              <SelectItem
                key={workflow}
                value={workflow}
                disabled={isWorkflowOptionDisabled(kind, workflow)}
              >
                {formatWorkflowOptionLabel(kind, workflow)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {workflowHelpText ? (
          <p className="mt-1 text-xs text-muted-foreground">{workflowHelpText}</p>
        ) : null}
      </td>
    </tr>
  );
}

function hasInvalidCatalogSelections(
  values: ILlmSetupFormValues,
  providerConnections: IProviderConnectionCatalogEntry[]
): string | null {
  for (const kind of ADMIN_CONFIGURABLE_GENERATION_KINDS) {
    const route = values.generationRoutes[kind];
    const metadata = GENERATION_KIND_METADATA[kind];
    const connection = providerConnections.find(
      (entry) => entry.id === route.connectionId
    );

    if (!connection) {
      return `${metadata.label}: selected provider connection does not exist.`;
    }

    if (connection.availableModels.length === 0) {
      return `${metadata.label}: ${connection.label} has no uploaded model catalog. Test or save the provider connection first.`;
    }

    if (
      !isModelInCatalogForModality(
        connection.availableModels,
        route.model,
        metadata.requiredModality
      )
    ) {
      return `${metadata.label}: model "${route.model}" is not in the ${connection.label} catalog for ${metadata.requiredModality}.`;
    }
  }

  return null;
}

export function LlmSetupForm({
  setupId,
  defaultValues,
  providerConnections,
  providerWarnings = [],
}: ILlmSetupFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [notice, setNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const form = useForm<ILlmSetupFormValues>({
    resolver: zodResolver(llmSetupFormSchema),
    defaultValues,
  });

  const handleSubmit = form.handleSubmit(async (values) => {
    setIsSubmitting(true);
    setNotice(null);

    const catalogError = hasInvalidCatalogSelections(values, providerConnections);
    if (catalogError) {
      setNotice(catalogError);
      setIsSubmitting(false);
      return;
    }

    try {
      const payload = {
        name: values.name.trim(),
        description: values.description?.trim() || undefined,
        generationRoutes: toGenerationRoutes(values),
      };

      const { response, payload: result } = await saveLlmSetup(setupId, payload);

      if (isAdminUnauthorizedResponse(response)) {
        redirectToAdminLogin(router, pathname);
        return;
      }

      if (!response.ok || !result.success) {
        setNotice(result.message ?? 'Failed to save LLM setup.');
        return;
      }

      router.push('/llm-setups');
      router.refresh();
    } catch {
      setNotice('Failed to save LLM setup.');
    } finally {
      setIsSubmitting(false);
    }
  });

  const handleDelete = async () => {
    if (!setupId) {
      return;
    }

    const confirmed = window.confirm(
      'Delete this LLM setup? This is blocked if any user groups still reference it.'
    );
    if (!confirmed) {
      return;
    }

    setIsDeleting(true);
    setNotice(null);

    try {
      const { response, payload: result } = await deleteLlmSetup(setupId);

      if (isAdminUnauthorizedResponse(response)) {
        redirectToAdminLogin(router, pathname);
        return;
      }

      if (!response.ok || !result.success) {
        setNotice(result.message ?? 'Failed to delete LLM setup.');
        return;
      }

      router.push('/llm-setups');
      router.refresh();
    } catch {
      setNotice('Failed to delete LLM setup.');
    } finally {
      setIsDeleting(false);
    }
  };

  const groups = getGenerationKindGroups();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{setupId ? 'Edit LLM setup' : 'Create LLM setup'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-6" onSubmit={handleSubmit}>
          {providerWarnings.length > 0 ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              {providerWarnings.map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" control={form.control} name="name" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input id="description" control={form.control} name="description" />
          </div>

          {groups.map((group) => (
            <div key={group.id} className="space-y-3">
              <h3 className="text-sm font-medium">{group.label}</h3>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-border bg-muted/50">
                    <tr>
                      <th className="px-3 py-2 font-medium" scope="col">Generation kind</th>
                      <th className="px-3 py-2 font-medium" scope="col">Provider connection</th>
                      <th className="px-3 py-2 font-medium" scope="col">Model</th>
                      <th className="px-3 py-2 font-medium" scope="col">Workflow</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.kinds.map((kind) => (
                      <GenerationKindRow
                        key={kind}
                        kind={kind}
                        connections={providerConnections}
                        control={form.control}
                        setValue={form.setValue}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          {notice ? <p className="text-sm text-destructive">{notice}</p> : null}

          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={isSubmitting || isDeleting}>
              {isSubmitting ? 'Saving…' : 'Save setup'}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.push('/llm-setups')}>
              Cancel
            </Button>
            {setupId ? (
              <Button
                type="button"
                variant="destructive"
                disabled={isSubmitting || isDeleting}
                onClick={handleDelete}
              >
                {isDeleting ? 'Deleting…' : 'Delete setup'}
              </Button>
            ) : null}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
