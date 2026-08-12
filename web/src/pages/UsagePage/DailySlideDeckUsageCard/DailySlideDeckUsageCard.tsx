import React from 'react';
import { formatDateWithOptions } from '../../../utils/dateUtils';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../../components/ui/Card';
import {
  calculateDailySlideDeckUsagePercent,
  roundPercent,
} from '../utils/usagePageUtils';
import type { IDailySlideDeckUsageCardProps } from './IDailySlideDeckUsageCard';

export const DailySlideDeckUsageCard: React.FC<IDailySlideDeckUsageCardProps> = ({
  dailySlideDecks,
}) => {
  const percent = calculateDailySlideDeckUsagePercent(dailySlideDecks);
  const roundedPercent = roundPercent(percent);
  const resetLabel = formatDateWithOptions(dailySlideDecks.resetAt, 'MMM d, yyyy HH:mm');
  const remaining = Math.max(0, dailySlideDecks.remaining);
  const percentAriaLabel = `${roundedPercent}% of daily slide deck limit used. ${remaining} of ${dailySlideDecks.limit} remaining.`;

  return (
    <Card className="shadow-none border-border/50">
      <CardHeader className="px-5 py-4">
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <CardTitle className="text-lg font-semibold leading-none">Daily Slide Decks</CardTitle>
            <CardDescription className="mt-1 text-sm">Resets on {resetLabel} UTC</CardDescription>
          </div>
          <span
            className="text-sm font-medium text-muted-foreground tabular-nums"
            aria-live="polite"
          >
            {dailySlideDecks.used} / {dailySlideDecks.limit}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 px-5 pb-5 pt-0">
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={roundedPercent}
          aria-label={percentAriaLabel}
          className="h-2 w-full overflow-hidden rounded-full bg-muted"
        >
          <div
            className="h-full bg-primary transition-[width] duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className="text-sm text-muted-foreground">
          {remaining} slide deck generation{remaining === 1 ? '' : 's'} remaining today.{' '}
          {dailySlideDecks.used} started.
        </p>
      </CardContent>
    </Card>
  );
};
