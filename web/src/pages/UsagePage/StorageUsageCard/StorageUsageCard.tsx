import React from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../../components/ui/Card';
import {
  calculateStorageUsagePercent,
  formatStorageBytes,
  roundPercent,
} from '../utils/usagePageUtils';
import type { IStorageUsageCardProps } from './IStorageUsageCard';

export const StorageUsageCard: React.FC<IStorageUsageCardProps> = ({ storage }) => {
  const percent = calculateStorageUsagePercent(storage);
  const roundedPercent = roundPercent(percent);
  const percentAriaLabel = `${roundedPercent}% of storage used. ${formatStorageBytes(
    storage.remainingBytes,
  )} of ${formatStorageBytes(storage.limitBytes)} remaining.`;

  return (
    <Card className="shadow-none border-border/50">
      <CardHeader className="px-5 py-4">
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <CardTitle className="text-lg font-semibold leading-none">Storage</CardTitle>
            <CardDescription className="mt-1 text-sm">
              Uploaded documents and generated slide images
            </CardDescription>
          </div>
          <span
            className="text-sm font-medium text-muted-foreground tabular-nums"
            aria-live="polite"
          >
            {roundedPercent}% used
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
          {formatStorageBytes(storage.remainingBytes)} of {formatStorageBytes(storage.limitBytes)}{' '}
          remaining. {formatStorageBytes(storage.usedBytes)} used.
        </p>
      </CardContent>
    </Card>
  );
};
