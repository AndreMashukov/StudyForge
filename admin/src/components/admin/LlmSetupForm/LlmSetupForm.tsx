'use client';

import type { IProviderConnectionCatalogEntry } from '@shared-types';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Input, Label } from '@study-forge/ui';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  isAdminUnauthorizedResponse,
  redirectToAdminLogin,
} from '../../../lib/auth/client-login-redirect';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/Card';
import {
  type ILlmSetupFormValues,
  filterConnectionsForModality,
  llmSetupFormSchema,
  toLlmSetupRoutes,
} from './LlmSetupForm.form';

export type { ILlmSetupFormValues } from './LlmSetupForm.form';

export interface ILlmSetupFormProps {
  setupId?: string;
  defaultValues: ILlmSetupFormValues;
  providerConnections: IProviderConnectionCatalogEntry[];
  providerWarnings?: string[];
}

function ModalityFields({
  label,
  connectionName,
  modelName,
  connections,
  register,
}: {
  label: string;
  connectionName: 'textConnectionId' | 'visionConnectionId' | 'imageConnectionId';
  modelName: 'textModel' | 'visionModel' | 'imageModel';
  connections: IProviderConnectionCatalogEntry[];
  register: ReturnType<typeof useForm<ILlmSetupFormValues>>['register'];
}) {
  return (
    <div className="space-y-3 rounded-lg border border-border p-4">
      <h3 className="text-sm font-medium">{label}</h3>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={connectionName}>Provider connection</Label>
          <select
            id={connectionName}
            className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            {...register(connectionName)}
          >
            {connections.map((connection) => (
              <option key={connection.id} value={connection.id}>
                {connection.label} ({connection.providerKind})
                {!connection.apiKeyConfigured ? ' — missing credentials' : ''}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor={modelName}>Model</Label>
          <Input id={modelName} {...register(modelName)} />
        </div>
      </div>
    </div>
  );
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

  const textConnections = filterConnectionsForModality(providerConnections, 'text');
  const visionConnections = filterConnectionsForModality(providerConnections, 'vision');
  const imageConnections = filterConnectionsForModality(providerConnections, 'image');

  const handleSubmit = form.handleSubmit(async (values) => {
    setIsSubmitting(true);
    setNotice(null);

    try {
      const payload = {
        name: values.name.trim(),
        description: values.description?.trim() || undefined,
        routes: toLlmSetupRoutes(values),
      };

      const response = await fetch(setupId ? `/api/llm-setups/${setupId}` : '/api/llm-setups', {
        method: setupId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (isAdminUnauthorizedResponse(response)) {
        redirectToAdminLogin(router, pathname);
        return;
      }

      const result = (await response.json()) as { success?: boolean; message?: string };

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
      const response = await fetch(`/api/llm-setups/${setupId}`, { method: 'DELETE' });

      if (isAdminUnauthorizedResponse(response)) {
        redirectToAdminLogin(router, pathname);
        return;
      }

      const result = (await response.json()) as { success?: boolean; message?: string };

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
            <Input id="name" {...form.register('name')} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input id="description" {...form.register('description')} />
          </div>

          <ModalityFields
            label="Text model"
            connectionName="textConnectionId"
            modelName="textModel"
            connections={textConnections}
            register={form.register}
          />
          <ModalityFields
            label="Vision model"
            connectionName="visionConnectionId"
            modelName="visionModel"
            connections={visionConnections}
            register={form.register}
          />
          <ModalityFields
            label="Image model"
            connectionName="imageConnectionId"
            modelName="imageModel"
            connections={imageConnections}
            register={form.register}
          />

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
