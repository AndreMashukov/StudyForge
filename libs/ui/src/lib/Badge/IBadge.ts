import type * as React from 'react';
import { type VariantProps } from 'class-variance-authority';
import { type badgeVariants } from './badgeVariants';

export interface IBadge
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}
