import React from 'react';
import { Gauge } from 'lucide-react';
import { Page } from '../../../components/Page';
import { Spinner } from '../../../components/ui/Spinner';
import { Card, CardContent } from '../../../components/ui/Card';
import { useUsagePageContext } from '../context/hooks/useUsagePageContext';
import { UsageCard } from '../UsageCard';
import { PlanCard } from '../PlanCard';

export const UsagePageContainer: React.FC = () => {
  const { usage } = useUsagePageContext();

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
              Track your monthly credit consumption and plan details.
            </p>
          </div>
        </header>
        <UsageCard summary={usage.data} />
        <PlanCard summary={usage.data} />
      </div>
    </Page>
  );
};
