import React, { useEffect, useState } from 'react';
import { DEFAULT_PAYG_MONTHLY_CAP_CENTS } from '@shared-types';
import { Gauge } from 'lucide-react';
import { Page } from '../../../components/Page';
import { Spinner } from '../../../components/ui/Spinner';
import { Card, CardContent } from '../../../components/ui/Card';
import { useUsagePageContext } from '../context/hooks/useUsagePageContext';
import { UsageCard } from '../UsageCard';
import { PlanCard } from '../PlanCard';
import { PayAsYouGoCard } from '../PayAsYouGoCard';

function defaultCapDollars(summaryCapCents?: number): string {
  const cents = summaryCapCents ?? DEFAULT_PAYG_MONTHLY_CAP_CENTS;
  return String(cents / 100);
}

export const UsagePageContainer: React.FC = () => {
  const { usage, handlers } = useUsagePageContext();
  const [monthlyCapDollars, setMonthlyCapDollars] = useState('20');
  const [hasEditedCap, setHasEditedCap] = useState(false);

  useEffect(() => {
    if (!hasEditedCap && usage.data?.payAsYouGo?.monthlyCapCents) {
      setMonthlyCapDollars(defaultCapDollars(usage.data.payAsYouGo.monthlyCapCents));
    }
  }, [hasEditedCap, usage.data?.payAsYouGo?.monthlyCapCents]);

  if (usage.isLoading) {
    return (
      <Page showSidebar={true}>
        <div className="flex flex-1 items-center justify-center py-12">
          <Spinner size="lg" variant="muted" />
        </div>
      </Page>
    );
  }

  if (usage.isError) {
    return (
      <Page showSidebar={true}>
        <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
          <header className="flex items-center gap-3">
            <Gauge className="h-6 w-6 text-primary" aria-hidden />
            <div>
              <h1 className="text-2xl font-bold text-foreground">Usage</h1>
              <p className="text-sm text-muted-foreground">
                Track your monthly credit consumption and plan details.
              </p>
            </div>
          </header>
          <Card className="shadow-none border-destructive/50">
            <CardContent className="px-5 py-6">
              <p className="text-sm text-destructive" role="alert">
                Unable to load usage data. Please try again in a moment.
              </p>
            </CardContent>
          </Card>
        </div>
      </Page>
    );
  }

  if (!usage.data) {
    return (
      <Page showSidebar={true}>
        <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
          <header className="flex items-center gap-3">
            <Gauge className="h-6 w-6 text-primary" aria-hidden />
            <div>
              <h1 className="text-2xl font-bold text-foreground">Usage</h1>
              <p className="text-sm text-muted-foreground">
                Track your monthly credit consumption and plan details.
              </p>
            </div>
          </header>
          <Card className="shadow-none border-border/50">
            <CardContent className="px-5 py-6">
              <p className="text-sm text-muted-foreground">
                No usage data is available yet.
              </p>
            </CardContent>
          </Card>
        </div>
      </Page>
    );
  }

  return (
    <Page showSidebar={true}>
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
        <header className="flex items-center gap-3">
          <Gauge className="h-6 w-6 text-primary" aria-hidden />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Usage</h1>
            <p className="text-sm text-muted-foreground">
              Track your monthly credit consumption, billing, and plan details.
            </p>
          </div>
        </header>
        <UsageCard summary={usage.data} />
        <PayAsYouGoCard
          summary={usage.data}
          monthlyCapDollars={monthlyCapDollars}
          isSaving={handlers.isSaving}
          billingError={handlers.billingError}
          onMonthlyCapChange={(value) => {
            setHasEditedCap(true);
            handlers.clearBillingError();
            setMonthlyCapDollars(value);
          }}
          onEnablePayAsYouGo={() => handlers.handleEnablePayAsYouGo(monthlyCapDollars)}
          onDisablePayAsYouGo={() => handlers.handleDisablePayAsYouGo(monthlyCapDollars)}
          onSetupBilling={() => {
            void handlers.handleSetupBilling();
          }}
          onManageBilling={() => {
            void handlers.handleManageBilling();
          }}
        />
        <PlanCard summary={usage.data} />
      </div>
      {handlers.isSaving ? (
        <div
          className="fixed inset-0 z-[1300] flex flex-col items-center justify-center gap-3 bg-background/80 backdrop-blur-sm"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <Spinner size="lg" variant="muted" />
          <p className="text-sm font-medium text-muted-foreground">Working</p>
        </div>
      ) : null}
    </Page>
  );
};
