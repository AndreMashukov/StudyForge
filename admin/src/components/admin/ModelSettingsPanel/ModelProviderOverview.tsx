'use client';

import type { ActiveModelProviderType } from '@shared-types';
import { Button } from '@study-forge/ui';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  isAdminUnauthorizedResponse,
  redirectToAdminLogin,
} from '../../../lib/auth/client-login-redirect';
import { Badge } from '../../ui/Badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../ui/Card';
import type { IModelProviderOverviewItem } from './modelProviderFields';

type NoticeState =
  | {
      type: 'success' | 'error';
      message: string;
    }
  | null;

export interface IModelProviderOverviewProps {
  activeProviderId: ActiveModelProviderType;
  providers: IModelProviderOverviewItem[];
}

interface IActiveProviderRouteResponse {
  success?: boolean;
  message?: string;
  activeProviderId?: ActiveModelProviderType;
}

function getStatusVariant(
  status: string
): 'default' | 'secondary' | 'outline' {
  if (status === 'healthy' || status === 'Active') {
    return 'default';
  }

  if (status === 'unhealthy') {
    return 'secondary';
  }

  return 'outline';
}

function ProviderCard({
  provider,
  isActivating,
  onActivate,
}: {
  provider: IModelProviderOverviewItem;
  isActivating: boolean;
  onActivate: (providerType: ActiveModelProviderType) => void;
}) {
  const configureHref = `/model-settings/${provider.providerType}`;

  return (
    <Card
      className={
        provider.isActive
          ? 'border-primary ring-1 ring-primary/40'
          : undefined
      }
    >
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-xl">{provider.label}</CardTitle>
          {provider.isActive ? (
            <Badge variant="default">Active</Badge>
          ) : null}
          {provider.staticBadges.map((badge) => (
            <Badge key={badge} variant="outline">
              {badge}
            </Badge>
          ))}
          {provider.statusBadges.map((badge) => (
            <Badge key={badge} variant={getStatusVariant(badge)}>
              {badge}
            </Badge>
          ))}
        </div>
        <CardDescription>{provider.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <label className="flex items-start gap-3 rounded-lg border border-border p-4 text-sm">
          <input
            type="radio"
            name="activeProvider"
            className="mt-0.5 h-4 w-4 border-border bg-input"
            checked={provider.isActive}
            disabled={!provider.canActivate || isActivating}
            onChange={() => onActivate(provider.providerType)}
            aria-label={`Set ${provider.label} as active provider`}
          />
          <span>
            <span className="block font-medium">
              {provider.isActive ? 'Active provider' : 'Set as active provider'}
            </span>
            <span className="text-muted-foreground">
              {provider.canActivate
                ? 'Routes eligible generation through this provider when selected.'
                : provider.activationBlockedReason}
            </span>
          </span>
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          {provider.overviewFields.map((field) => (
            <div key={field.label} className="rounded-lg border border-border p-4 text-sm">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {field.label}
              </p>
              <p className="mt-2 break-all font-medium">{field.value}</p>
            </div>
          ))}
        </div>

        <Button asChild variant={provider.isEditable ? 'default' : 'outline'}>
          <Link href={configureHref}>
            {provider.isEditable ? 'Configure' : 'View details'} →
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export function ModelProviderOverview({
  activeProviderId: initialActiveProviderId,
  providers: initialProviders,
}: IModelProviderOverviewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [activeProviderId, setActiveProviderId] = useState(initialActiveProviderId);
  const [providers, setProviders] = useState(initialProviders);
  const [notice, setNotice] = useState<NoticeState>(null);
  const [isActivating, setIsActivating] = useState(false);

  const handleActivate = async (providerType: ActiveModelProviderType) => {
    if (providerType === activeProviderId || isActivating) {
      return;
    }

    setNotice(null);
    setIsActivating(true);

    try {
      const response = await fetch('/api/model-settings/active-provider', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ providerType }),
      });

      if (isAdminUnauthorizedResponse(response)) {
        setNotice({
          type: 'error',
          message: 'Your session has expired. Redirecting to sign in…',
        });
        redirectToAdminLogin(router, pathname);
        return;
      }

      const payload = (await response.json()) as IActiveProviderRouteResponse;

      if (!response.ok || !payload.success || !payload.activeProviderId) {
        throw new Error(payload.message || 'Failed to update active provider.');
      }

      setActiveProviderId(payload.activeProviderId);
      setProviders((current) =>
        current.map((provider) => ({
          ...provider,
          isActive: provider.providerType === payload.activeProviderId,
        }))
      );
      setNotice({
        type: 'success',
        message: `${providerType === 'gemini' ? 'Gemini' : 'OpenRouter'} is now the active provider.`,
      });
      router.refresh();
    } catch (error) {
      setNotice({
        type: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to update active provider.',
      });
    } finally {
      setIsActivating(false);
    }
  };

  return (
    <div className="space-y-4">
      {notice ? (
        <p
          className={
            notice.type === 'success'
              ? 'text-sm text-primary'
              : 'text-sm text-destructive'
          }
          role="alert"
        >
          {notice.message}
        </p>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        {providers.map((provider) => (
          <ProviderCard
            key={provider.providerType}
            provider={{
              ...provider,
              isActive: provider.providerType === activeProviderId,
            }}
            isActivating={isActivating}
            onActivate={handleActivate}
          />
        ))}
      </div>

      <p className="text-sm text-muted-foreground">
        Only one provider can be active at a time. Switching takes effect immediately
        for eligible generation routes.
      </p>
    </div>
  );
}
