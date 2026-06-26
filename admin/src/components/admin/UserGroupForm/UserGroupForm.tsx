'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Input, Label } from '@study-forge/ui';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  isAdminUnauthorizedResponse,
  redirectToAdminLogin,
} from '../../../lib/auth/client-login-redirect';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/Card';

const userGroupFormSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  llmSetupId: z.string().trim().min(1, 'LLM setup is required'),
});

export type IUserGroupFormValues = z.infer<typeof userGroupFormSchema>;

export interface IUserGroupFormProps {
  groupId?: string;
  defaultValues: IUserGroupFormValues;
  setupOptions: Array<{ id: string; name: string }>;
}

export function UserGroupForm({ groupId, defaultValues, setupOptions }: IUserGroupFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [notice, setNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const form = useForm<IUserGroupFormValues>({
    resolver: zodResolver(userGroupFormSchema),
    defaultValues,
  });

  const handleSubmit = form.handleSubmit(async (values) => {
    setIsSubmitting(true);
    setNotice(null);

    try {
      const payload = {
        name: values.name.trim(),
        llmSetupId: values.llmSetupId.trim(),
      };

      const response = await fetch(
        groupId ? `/api/user-groups/${groupId}` : '/api/user-groups',
        {
          method: groupId ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );

      if (isAdminUnauthorizedResponse(response)) {
        redirectToAdminLogin(router, pathname);
        return;
      }

      const result = (await response.json()) as { success?: boolean; message?: string };

      if (!response.ok || !result.success) {
        setNotice(result.message ?? 'Failed to save user group.');
        return;
      }

      router.push('/user-groups');
      router.refresh();
    } catch {
      setNotice('Failed to save user group.');
    } finally {
      setIsSubmitting(false);
    }
  });

  const handleDelete = async () => {
    if (!groupId) {
      return;
    }

    const confirmed = window.confirm(
      'Delete this user group? This is blocked if any users are still assigned to it.'
    );
    if (!confirmed) {
      return;
    }

    setIsDeleting(true);
    setNotice(null);

    try {
      const response = await fetch(`/api/user-groups/${groupId}`, { method: 'DELETE' });

      if (isAdminUnauthorizedResponse(response)) {
        redirectToAdminLogin(router, pathname);
        return;
      }

      const result = (await response.json()) as { success?: boolean; message?: string };

      if (!response.ok || !result.success) {
        setNotice(result.message ?? 'Failed to delete user group.');
        return;
      }

      router.push('/user-groups');
      router.refresh();
    } catch {
      setNotice('Failed to delete user group.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{groupId ? 'Edit user group' : 'Create user group'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" {...form.register('name')} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="llmSetupId">LLM setup</Label>
            <select
              id="llmSetupId"
              className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              {...form.register('llmSetupId')}
            >
              <option value="">Select a setup</option>
              {setupOptions.map((setup) => (
                <option key={setup.id} value={setup.id}>
                  {setup.name}
                </option>
              ))}
            </select>
          </div>

          {notice ? <p className="text-sm text-destructive">{notice}</p> : null}

          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={isSubmitting || isDeleting}>
              {isSubmitting ? 'Saving…' : 'Save group'}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.push('/user-groups')}>
              Cancel
            </Button>
            {groupId ? (
              <Button
                type="button"
                variant="destructive"
                disabled={isSubmitting || isDeleting}
                onClick={handleDelete}
              >
                {isDeleting ? 'Deleting…' : 'Delete group'}
              </Button>
            ) : null}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
