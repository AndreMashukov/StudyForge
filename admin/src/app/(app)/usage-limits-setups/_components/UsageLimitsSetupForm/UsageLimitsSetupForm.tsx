'use client';

import {
  GENERATION_KIND_METADATA,
  type GenerationKind,
} from '@shared-types';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Label } from '@study-forge/ui';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm, Controller, type Control, type Path } from 'react-hook-form';
import {
  isAdminUnauthorizedResponse,
  redirectToAdminLogin,
} from '@admin/auth/client-login-redirect';
import {
  deleteUsageLimitsSetup,
  saveUsageLimitsSetup,
} from '@admin/mutations/usage-limits-setups';
import { Card, CardContent, CardHeader, CardTitle } from '@admin/components/ui/Card';
import { Input } from '@admin/components/ui/Input';
import {
  type IUsageLimitsSetupFormValues,
  getUsageFeatureGroups,
  toFeaturePolicies,
  usageLimitsSetupFormSchema,
} from './UsageLimitsSetupForm.form';

export type { IUsageLimitsSetupFormValues } from './UsageLimitsSetupForm.form';

export interface IUsageLimitsSetupFormProps {
  setupId?: string;
  defaultValues: IUsageLimitsSetupFormValues;
}

function featurePolicyField(
  kind: GenerationKind,
  field: 'enabled' | 'creditCost'
): Path<IUsageLimitsSetupFormValues> {
  return `featurePolicies.${kind}.${field}`;
}

function FeaturePolicyRow({
  kind,
  control,
}: {
  kind: GenerationKind;
  control: Control<IUsageLimitsSetupFormValues>;
}) {
  const metadata = GENERATION_KIND_METADATA[kind];

  return (
    <tr className="border-b border-border last:border-0">
      <td className="px-3 py-3 align-top">
        <div className="font-medium">{metadata.label}</div>
        <p className="text-xs text-muted-foreground">{metadata.description}</p>
      </td>
      <td className="px-3 py-3 align-top">
        <Controller
          control={control}
          name={featurePolicyField(kind, 'enabled')}
          render={({ field }) => (
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={Boolean(field.value)}
                onChange={(event) => field.onChange(event.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              Enabled
            </label>
          )}
        />
      </td>
      <td className="px-3 py-3 align-top">
        <Input
          control={control}
          name={featurePolicyField(kind, 'creditCost')}
          type="number"
          min={0}
          step={1}
        />
      </td>
    </tr>
  );
}

export function UsageLimitsSetupForm({ setupId, defaultValues }: IUsageLimitsSetupFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [notice, setNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const form = useForm<IUsageLimitsSetupFormValues>({
    resolver: zodResolver(usageLimitsSetupFormSchema),
    defaultValues,
  });

  const handleSubmit = form.handleSubmit(async (values) => {
    setIsSubmitting(true);
    setNotice(null);

    try {
      const payload = {
        name: values.name.trim(),
        description: values.description?.trim() || undefined,
        monthlyCreditAllowance: values.monthlyCreditAllowance,
        featurePolicies: toFeaturePolicies(values),
      };

      const { response, payload: result } = await saveUsageLimitsSetup(setupId, payload);

      if (isAdminUnauthorizedResponse(response)) {
        redirectToAdminLogin(router, pathname);
        return;
      }

      if (!response.ok || !result.success) {
        setNotice(result.message ?? 'Failed to save usage limits setup.');
        return;
      }

      router.push('/usage-limits-setups');
      router.refresh();
    } catch {
      setNotice('Failed to save usage limits setup.');
    } finally {
      setIsSubmitting(false);
    }
  });

  const handleDelete = async () => {
    if (!setupId) {
      return;
    }

    const confirmed = window.confirm(
      'Delete this usage limits setup? This is blocked if any user groups still reference it.'
    );
    if (!confirmed) {
      return;
    }

    setIsDeleting(true);
    setNotice(null);

    try {
      const { response, payload: result } = await deleteUsageLimitsSetup(setupId);

      if (isAdminUnauthorizedResponse(response)) {
        redirectToAdminLogin(router, pathname);
        return;
      }

      if (!response.ok || !result.success) {
        setNotice(result.message ?? 'Failed to delete usage limits setup.');
        return;
      }

      router.push('/usage-limits-setups');
      router.refresh();
    } catch {
      setNotice('Failed to delete usage limits setup.');
    } finally {
      setIsDeleting(false);
    }
  };

  const groups = getUsageFeatureGroups();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{setupId ? 'Edit usage limits setup' : 'Create usage limits setup'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-8" onSubmit={handleSubmit}>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" control={form.control} name="name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="monthlyCreditAllowance">Monthly credit allowance</Label>
              <Input
                id="monthlyCreditAllowance"
                control={form.control}
                name="monthlyCreditAllowance"
                type="number"
                min={0}
                step={1}
              />
            </div>
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
                      <th className="px-3 py-3 font-medium" scope="col">
                        Feature
                      </th>
                      <th className="px-3 py-3 font-medium" scope="col">
                        Access
                      </th>
                      <th className="px-3 py-3 font-medium" scope="col">
                        Credit cost
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.kinds.map((kind) => (
                      <FeaturePolicyRow key={kind} kind={kind} control={form.control} />
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
            <Button type="button" variant="outline" onClick={() => router.push('/usage-limits-setups')}>
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
