'use client';

import { Button, Label } from '@study-forge/ui';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  isAdminUnauthorizedResponse,
  redirectToAdminLogin,
} from '@admin/auth/client-login-redirect';
import { updateUserVerificationExemption } from '@admin/mutations/users';
import { Card, CardContent, CardHeader, CardTitle } from '@admin/components/ui/Card';

export interface IUserVerificationExemptionFormProps {
  userId: string;
  emailVerified: boolean;
  emailVerificationExempt: boolean;
}

export function UserVerificationExemptionForm({
  userId,
  emailVerified,
  emailVerificationExempt,
}: IUserVerificationExemptionFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isExempt, setIsExempt] = useState(emailVerificationExempt);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setNotice(null);

    try {
      const { response, payload: result } = await updateUserVerificationExemption(
        userId,
        isExempt,
      );

      if (isAdminUnauthorizedResponse(response)) {
        redirectToAdminLogin(router, pathname);
        return;
      }

      if (!response.ok || !result.success) {
        setNotice(result.message ?? 'Failed to update verification exemption.');
        return;
      }

      router.refresh();
    } catch {
      setNotice('Failed to update verification exemption.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Email verification access</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <p className="text-sm text-muted-foreground">
            Firebase email status: {emailVerified ? 'verified' : 'not verified'}.
          </p>
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={isExempt}
              onChange={(event) => setIsExempt(event.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-border"
            />
            <span>
              <Label className="block">Exempt from email verification gate</Label>
              <span className="block text-muted-foreground">
                Allows this user to access StudyForge even when Firebase email is not verified.
              </span>
            </span>
          </label>

          {notice ? <p className="text-sm text-destructive">{notice}</p> : null}

          <Button type="submit" disabled={isSubmitting || isExempt === emailVerificationExempt}>
            {isSubmitting ? 'Saving...' : 'Save verification access'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
