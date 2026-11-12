import * as React from 'react';
import { cn } from '../utils';
import { badgeVariants } from './badgeVariants';
import { type IBadge } from './IBadge';

export const Badge = React.forwardRef<HTMLSpanElement, IBadge>(
  ({ className, variant, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  ),
);
Badge.displayName = 'Badge';
