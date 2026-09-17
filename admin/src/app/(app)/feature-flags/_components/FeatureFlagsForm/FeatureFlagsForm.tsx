'use client';

import type { IFeatureFlags } from '@shared-types';
import { usePathname, useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import {
  isAdminUnauthorizedResponse,
  redirectToAdminLogin,
} from '@admin/auth/client-login-redirect';
import { saveFeatureFlags } from '@admin/mutations/feature-flags';
import { Button } from '@admin/components/ui/Button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@admin/components/ui/Card';
import { Checkbox } from '@admin/components/ui/Checkbox';
import { Label } from '@admin/components/ui/Label';

export interface IFeatureFlagsFormProps {
  flags: IFeatureFlags;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function FeatureFlagsForm({ flags }: IFeatureFlagsFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [supportEnabled, setSupportEnabled] = useState(flags.supportEnabled);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    setNotice(null);

    try {
      const { response, payload } = await saveFeatureFlags({
        supportEnabled,
      });

      if (isAdminUnauthorizedResponse(response)) {
        redirectToAdminLogin(router, pathname);
        return;
      }

      if (!response.ok) {
        const message =
          isRecord(payload) && typeof payload.message === 'string'
            ? payload.message
            : 'Failed to save feature flags.';
        setNotice({ type: 'error', message });
        return;
      }

      setNotice({ type: 'success', message: 'Feature flags saved.' });
      router.refresh();
    } catch {
      setNotice({ type: 'error', message: 'Failed to save feature flags.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Product flags</CardTitle>
        <CardDescription>
          Control which StudyForge surfaces are visible without a deploy. A
          missing document uses emulator-on and production-off defaults.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-6" onSubmit={handleSubmit}>
          <label className="flex items-start gap-3 text-sm">
            <Checkbox
              checked={supportEnabled}
              onChange={(event) => setSupportEnabled(event.target.checked)}
              className="mt-0.5"
            />
            <span>
              <Label className="block">Support</Label>
              <span className="block text-muted-foreground">
                Show Help in the web app and link to the support app. Direct
                visits to the support URL still work.
              </span>
            </span>
          </label>

          {notice ? (
            <p
              className={
                notice.type === 'success'
                  ? 'text-sm text-accent'
                  : 'text-sm text-destructive'
              }
              role={notice.type === 'success' ? 'status' : 'alert'}
            >
              {notice.message}
            </p>
          ) : null}

          <div className="flex justify-end">
            <Button type="submit" disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save feature flags'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
