import type { JSX } from 'react';
import { cn } from '../../../lib/utils';
import { IIndeterminateLinearProgress } from './IIndeterminateLinearProgress';
import { indeterminateLinearProgressStyles } from './IndeterminateLinearProgress.styles';

export const IndeterminateLinearProgress = ({
  className,
}: IIndeterminateLinearProgress): JSX.Element => (
  <div
    role="progressbar"
    aria-label="Loading"
    aria-valuetext="Loading"
    className={cn(indeterminateLinearProgressStyles.track, className)}
  >
    <div className={indeterminateLinearProgressStyles.bar} />
  </div>
);

IndeterminateLinearProgress.displayName = 'IndeterminateLinearProgress';
