import React from 'react';
import { Check, Crown } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { formatCurrencyFromCents } from '@shared-types';
import { formatCreditCount, formatStorageBytes } from '../utils/usagePageUtils';
import type { ISubscriptionPlansCardProps } from './ISubscriptionPlansCard';

export const SubscriptionPlansCard: React.FC<ISubscriptionPlansCardProps> = ({
  summary,
  plans,
  isLoading,
  isSaving,
  onSelectPlan,
  onManageBilling,
}) => {
  return (
    <Card className="shadow-none border-border/50">
      <CardHeader className="px-5 py-4">
        <div className="flex items-center gap-2">
          <Crown className="h-5 w-5 text-primary" aria-hidden />
          <div>
            <CardTitle className="text-lg font-semibold leading-none">Plans</CardTitle>
            <CardDescription className="text-sm">
              Free is active by default. Paid plans add monthly credits and optional overage.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 px-5 pb-5 pt-0">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading plans...</p>
        ) : null}
        {!isLoading && plans.length === 0 ? (
          <p className="text-sm text-muted-foreground">No public plans are configured yet.</p>
        ) : null}
        <div className="grid gap-4 md:grid-cols-2">
          {plans.map((plan) => {
            const isCurrent = summary.usageLimitsSetupId === plan.usageLimitsSetupId;
            const priceLabel = plan.isFreePlan
              ? 'Free'
              : `${formatCurrencyFromCents(plan.monthlyPriceCents)}/mo`;
            const canCheckout = !plan.isFreePlan && Boolean(plan.stripePriceId);

            return (
              <div
                key={plan.usageLimitsSetupId}
                className="rounded-2xl border border-border/60 bg-muted/20 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-foreground">{plan.name}</h3>
                    {plan.description ? (
                      <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
                    ) : null}
                  </div>
                  {isCurrent ? <Badge variant="default">Current</Badge> : null}
                </div>
                <p className="mt-4 text-2xl font-semibold text-foreground">{priceLabel}</p>
                <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary" aria-hidden />
                    {formatCreditCount(plan.monthlyCreditAllowance)} monthly credits
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary" aria-hidden />
                    {formatStorageBytes(plan.storageLimitBytes)} storage
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary" aria-hidden />
                    {formatCreditCount(plan.dailySlideDeckLimit)} slide decks per day
                  </li>
                </ul>
                <div className="mt-5">
                  {isCurrent && !plan.isFreePlan ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={onManageBilling}
                      disabled={isSaving}
                      className="w-full"
                    >
                      Manage subscription
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant={plan.isFreePlan ? 'outline' : 'default'}
                      onClick={() => onSelectPlan(plan.usageLimitsSetupId)}
                      disabled={isSaving || isCurrent || !canCheckout}
                      className="w-full"
                    >
                      {isCurrent ? 'Current plan' : plan.isFreePlan ? 'Included' : 'Choose plan'}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
