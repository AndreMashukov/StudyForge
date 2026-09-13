import React from 'react';
import { usagePlanTileClassName } from '../UsagePage.styles';

function PlanTileSkeleton() {
  return (
    <div className={`${usagePlanTileClassName} animate-pulse space-y-4`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-2">
          <div className="h-4 w-24 rounded bg-muted-foreground/20" />
          <div className="h-3 w-full max-w-[220px] rounded bg-muted-foreground/20" />
        </div>
        <div className="h-5 w-14 rounded-full bg-muted-foreground/20" />
      </div>
      <div className="h-8 w-28 rounded bg-muted-foreground/20" />
      <ul className="space-y-2">
        <li className="h-4 w-full max-w-[200px] rounded bg-muted-foreground/20" />
        <li className="h-4 w-full max-w-[180px] rounded bg-muted-foreground/20" />
        <li className="h-4 w-full max-w-[190px] rounded bg-muted-foreground/20" />
      </ul>
      <div className="h-10 w-full rounded-md bg-muted-foreground/20" />
    </div>
  );
}

export const SubscriptionPlansSkeleton: React.FC = () => {
  return (
    <div
      className="grid gap-4 md:grid-cols-2"
      aria-busy="true"
      aria-live="polite"
      aria-label="Loading subscription plans"
    >
      <PlanTileSkeleton />
      <PlanTileSkeleton />
    </div>
  );
};
