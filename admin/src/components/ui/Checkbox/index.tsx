'use client';

import * as React from 'react';
import { cn } from '@admin/utils';

export type ICheckboxProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'type'
>;

export const Checkbox = React.forwardRef<HTMLInputElement, ICheckboxProps>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      type="checkbox"
      className={cn('h-4 w-4 rounded border-border', className)}
      {...props}
    />
  ),
);
Checkbox.displayName = 'Checkbox';
