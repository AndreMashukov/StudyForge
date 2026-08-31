import React from 'react';
import { CreditCard } from 'lucide-react';
import {
  DEFAULT_PAYG_MONTHLY_CAP_CENTS,
  formatCreditUnitPriceFromCents,
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
import { cn } from '../../../lib/utils';
import {
  formatCreditCount,
  isMonthlyCapInputDirty,
  MONTHLY_CAP_ERROR_MESSAGE,
  parseMonthlyCapDollars,
} from '../utils/usagePageUtils';
import type { IPayAsYouGoCardProps } from './IPayAsYouGoCard';

export const PayAsYouGoCard: React.FC<IPayAsYouGoCardProps> = ({
  summary,
  monthlyCapDollars,
  isSaving,
  billingError,
  onMonthlyCapChange,
  onSaveMonthlyCap,
  onEnablePayAsYouGo,
  onDisablePayAsYouGo,
  onManageBilling,
}) => {
  const payAsYouGo = summary.payAsYouGo;
  const hasPaymentMethod = payAsYouGo?.hasPaymentMethod ?? false;
  const isEnabled = payAsYouGo?.enabled ?? false;
  const pricePerCredit = payAsYouGo?.pricePerCreditCents ?? 0;
  const spentOverage = payAsYouGo?.spentOverageAmountCents ?? 0;
  const remainingCap = payAsYouGo?.remainingCapCents ?? 0;
  const monthlyCap = payAsYouGo?.monthlyCapCents ?? DEFAULT_PAYG_MONTHLY_CAP_CENTS;
  const isCapValid = parseMonthlyCapDollars(monthlyCapDollars) !== null;
  const isCapDirty = isMonthlyCapInputDirty(monthlyCapDollars, monthlyCap);
  const canSaveCap = isCapDirty && isCapValid && !isSaving;

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
        {billingError ? (
          <p className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
            {billingError}
          </p>
        ) : null}
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
              {formatCreditUnitPriceFromCents(pricePerCredit)}
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
              Choose a paid plan before enabling pay-as-you-go overage billing.
            </p>
          </div>
        ) : (
          <div className="space-y-4 rounded-lg border border-border/60 bg-muted/20 p-4">
            <form
              className="space-y-2"
              onSubmit={(event) => {
                event.preventDefault();
                if (!canSaveCap) {
                  return;
                }
                onSaveMonthlyCap();
              }}
            >
              <Label htmlFor="monthly-cap">Monthly spending cap (USD)</Label>
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <Input
                    id="monthly-cap"
                    type="number"
                    min={1}
                    step={1}
                    value={monthlyCapDollars}
                    onChange={(event) => onMonthlyCapChange(event.target.value)}
                    disabled={isSaving}
                    aria-invalid={!isCapValid}
                    aria-describedby="monthly-cap-hint"
                    className={cn(!isCapValid && 'border-destructive hover:border-destructive')}
                  />
                </div>
                {isCapDirty ? (
                  <Button type="submit" disabled={!isCapValid || isSaving} className="shrink-0">
                    Save
                  </Button>
                ) : null}
              </div>
              <p
                id="monthly-cap-hint"
                className={cn('text-xs', isCapValid ? 'text-muted-foreground' : 'text-destructive')}
                role={isCapValid ? undefined : 'alert'}
              >
                {isCapValid
                  ? 'Suggested default is $20/month. Overage is invoiced monthly.'
                  : MONTHLY_CAP_ERROR_MESSAGE}
              </p>
            </form>

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
                disabled={isSaving || !isCapValid}
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
