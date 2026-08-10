import React from 'react';
import { CreditCard } from 'lucide-react';
import {
  DEFAULT_PAYG_MONTHLY_CAP_CENTS,
  formatCurrencyFromCents,
} from '@shared-types';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Label } from '../../../components/ui/Label';
import { Checkbox } from '../../../components/ui/Checkbox';
import { formatCreditCount } from '../utils/usagePageUtils';
import type { IPayAsYouGoCardProps } from './IPayAsYouGoCard';

export const PayAsYouGoCard: React.FC<IPayAsYouGoCardProps> = ({
  summary,
  monthlyCapDollars,
  isSaving,
  onMonthlyCapChange,
  onEnablePayAsYouGo,
  onDisablePayAsYouGo,
  onSetupBilling,
  onManageBilling,
}) => {
  const payAsYouGo = summary.payAsYouGo;
  const hasPaymentMethod = payAsYouGo?.hasPaymentMethod ?? false;
  const isEnabled = payAsYouGo?.enabled ?? false;
  const pricePerCredit = payAsYouGo?.pricePerCreditCents ?? 0;
  const spentOverage = payAsYouGo?.spentOverageAmountCents ?? 0;
  const remainingCap = payAsYouGo?.remainingCapCents ?? 0;
  const monthlyCap = payAsYouGo?.monthlyCapCents ?? DEFAULT_PAYG_MONTHLY_CAP_CENTS;

  const billingStatusLabel =
    payAsYouGo?.billingStatus === 'active'
      ? 'Active'
      : payAsYouGo?.billingStatus === 'past_due'
        ? 'Past due'
        : payAsYouGo?.billingStatus === 'payment_method_required'
          ? 'Payment method required'
          : 'Not set up';

  return (
    <Card className="shadow-none border-border/50">
      <CardHeader className="px-5 py-4">
        <div className="flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-primary" aria-hidden />
          <div>
            <CardTitle className="text-lg font-semibold leading-none">Pay-as-you-go</CardTitle>
            <CardDescription className="text-sm">
              Continue past included credits with a monthly spending cap.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 px-5 pb-5 pt-0">
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Billing status
            </dt>
            <dd className="text-sm font-medium text-foreground">{billingStatusLabel}</dd>
          </div>
          <div className="space-y-1">
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Price per credit
            </dt>
            <dd className="text-sm font-medium text-foreground tabular-nums">
              {formatCurrencyFromCents(pricePerCredit)}
            </dd>
          </div>
          <div className="space-y-1">
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Overage this month
            </dt>
            <dd className="text-sm font-medium text-foreground tabular-nums">
              {formatCurrencyFromCents(spentOverage)}
            </dd>
          </div>
          <div className="space-y-1">
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Remaining cap
            </dt>
            <dd className="text-sm font-medium text-foreground tabular-nums">
              {formatCurrencyFromCents(remainingCap)} of {formatCurrencyFromCents(monthlyCap)}
            </dd>
          </div>
          <div className="space-y-1">
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Overage credits used
            </dt>
            <dd className="text-sm font-medium text-foreground tabular-nums">
              {formatCreditCount(summary.spentOverageCredits ?? 0)}
            </dd>
          </div>
        </dl>

        {!hasPaymentMethod ? (
          <div className="space-y-3 rounded-lg border border-border/60 bg-muted/20 p-4">
            <p className="text-sm text-muted-foreground">
              Add a payment method to enable pay-as-you-go overage billing.
            </p>
            <Button type="button" onClick={onSetupBilling} disabled={isSaving}>
              Set up billing
            </Button>
          </div>
        ) : (
          <div className="space-y-4 rounded-lg border border-border/60 bg-muted/20 p-4">
            <div className="space-y-2">
              <Label htmlFor="monthly-cap">Monthly spending cap (USD)</Label>
              <Input
                id="monthly-cap"
                type="number"
                min={1}
                step={1}
                value={monthlyCapDollars}
                onChange={(event) => onMonthlyCapChange(event.target.value)}
                disabled={isSaving}
              />
              <p className="text-xs text-muted-foreground">
                Suggested default is $20/month. Overage is invoiced monthly.
              </p>
            </div>

            <label className="flex items-start gap-3">
              <Checkbox
                checked={isEnabled}
                onChange={(checked) => {
                  if (checked) {
                    onEnablePayAsYouGo();
                    return;
                  }
                  onDisablePayAsYouGo();
                }}
                disabled={isSaving}
                aria-label="Enable pay-as-you-go overage"
              />
              <span className="text-sm text-foreground">
                Enable pay-as-you-go when included credits run out
              </span>
            </label>

            <Button type="button" variant="outline" onClick={onManageBilling} disabled={isSaving}>
              Manage billing
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
