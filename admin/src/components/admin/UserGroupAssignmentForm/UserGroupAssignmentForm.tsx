'use client';

import { Button, Label } from '@study-forge/ui';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  isAdminUnauthorizedResponse,
  redirectToAdminLogin,
} from '../../../lib/auth/client-login-redirect';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/Card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/Select';

export interface IUserGroupAssignmentFormProps {
  userId: string;
  currentGroupId?: string;
  groupOptions: Array<{ id: string; name: string }>;
}

export function UserGroupAssignmentForm({
  userId,
  currentGroupId,
  groupOptions,
}: IUserGroupAssignmentFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [selectedGroupId, setSelectedGroupId] = useState(currentGroupId ?? '');
  const [notice, setNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setNotice(null);

    try {
      const response = await fetch(`/api/users/${userId}/group`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userGroupId: selectedGroupId }),
      });

      if (isAdminUnauthorizedResponse(response)) {
        redirectToAdminLogin(router, pathname);
        return;
      }

      const result = (await response.json()) as { success?: boolean; message?: string };

      if (!response.ok || !result.success) {
        setNotice(result.message ?? 'Failed to assign user group.');
        return;
      }

      router.refresh();
    } catch {
      setNotice('Failed to assign user group.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>User group assignment</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="userGroupId">User group</Label>
            <Select
              value={selectedGroupId || undefined}
              onValueChange={setSelectedGroupId}
            >
              <SelectTrigger id="userGroupId" aria-label="User group">
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent>
                {groupOptions.map((group) => (
                  <SelectItem key={group.id} value={group.id}>
                    {group.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {notice ? <p className="text-sm text-destructive">{notice}</p> : null}

          <Button type="submit" disabled={isSubmitting || !selectedGroupId}>
            {isSubmitting ? 'Saving…' : 'Assign group'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
