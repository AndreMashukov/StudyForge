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
import {
  usageMeterCardClassName,
  usageMeterHeaderClassName,
  usageMeterProgressFillClassName,
  usageMeterProgressTrackClassName,
  usageMeterStatPillClassName,
} from '../UsagePage.styles';
import type { IStorageUsageCardProps } from './IStorageUsageCard';

export const StorageUsageCard: React.FC<IStorageUsageCardProps> = ({ storage }) => {
  const percent = calculateStorageUsagePercent(storage);
  const roundedPercent = roundPercent(percent);
  const percentAriaLabel = `${roundedPercent}% of storage used. ${formatStorageBytes(
    storage.remainingBytes,
  )} of ${formatStorageBytes(storage.limitBytes)} remaining.`;

  return (
    <Card className={usageMeterCardClassName}>
      <CardHeader className="px-5 py-4">
        <div className={usageMeterHeaderClassName}>
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-lg font-semibold leading-none">Storage</CardTitle>
            <CardDescription className="text-sm">
              Uploaded documents and generated slide images
            </CardDescription>
          </div>
          <span className={usageMeterStatPillClassName} aria-live="polite">
            {roundedPercent}% used
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 px-5 pb-5 pt-0">
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={roundedPercent}
          aria-label={percentAriaLabel}
          className={usageMeterProgressTrackClassName}
        >
          <div
            className={usageMeterProgressFillClassName}
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
