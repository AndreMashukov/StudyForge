'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Label } from '@study-forge/ui';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  isAdminUnauthorizedResponse,
  redirectToAdminLogin,
} from '@admin/auth/client-login-redirect';
import { deleteUserGroup, saveUserGroup } from '@admin/mutations/user-groups';
import { Card, CardContent, CardHeader, CardTitle } from '@admin/components/ui/Card';
import { Input } from '@admin/components/ui/Input';
import { SelectContent, SelectItem, SelectTrigger, SelectValue } from '@study-forge/ui';
import { Select } from '@admin/components/ui/Select';

const userGroupFormSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  llmSetupId: z.string().trim().min(1, 'LLM setup is required'),
  usageLimitsSetupId: z.string().trim().min(1, 'Usage limits setup is required'),
});

export type IUserGroupFormValues = z.infer<typeof userGroupFormSchema>;

export interface IUserGroupFormProps {
  groupId?: string;
  defaultValues: IUserGroupFormValues;
  setupOptions: Array<{ id: string; name: string }>;
  usageLimitsSetupOptions: Array<{ id: string; name: string }>;
}

export function UserGroupForm({
  groupId,
  defaultValues,
  setupOptions,
  usageLimitsSetupOptions,
}: IUserGroupFormProps) {
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
        usageLimitsSetupId: values.usageLimitsSetupId.trim(),
      };

      const { response, payload: result } = await saveUserGroup(groupId, payload);

      if (isAdminUnauthorizedResponse(response)) {
        redirectToAdminLogin(router, pathname);
        return;
      }

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
      const { response, payload: result } = await deleteUserGroup(groupId);

      if (isAdminUnauthorizedResponse(response)) {
        redirectToAdminLogin(router, pathname);
        return;
      }

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
            <Input id="name" control={form.control} name="name" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="llmSetupId">LLM setup</Label>
            <Select control={form.control} name="llmSetupId">
              <SelectTrigger id="llmSetupId" aria-label="LLM setup">
                <SelectValue placeholder="Select a setup" />
              </SelectTrigger>
              <SelectContent>
                {setupOptions.map((setup) => (
                  <SelectItem key={setup.id} value={setup.id}>
                    {setup.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="usageLimitsSetupId">Usage limits setup</Label>
            <Select control={form.control} name="usageLimitsSetupId">
              <SelectTrigger id="usageLimitsSetupId" aria-label="Usage limits setup">
                <SelectValue placeholder="Select a setup" />
              </SelectTrigger>
              <SelectContent>
                {usageLimitsSetupOptions.map((setup) => (
                  <SelectItem key={setup.id} value={setup.id}>
                    {setup.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
