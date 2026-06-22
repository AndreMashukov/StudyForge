'use client';

import * as React from 'react';
import { cn } from '../utils';
import { type IInput } from './IInput';
import { inputStyles } from './Input.styles';

export const Input = React.forwardRef<HTMLInputElement, IInput>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(inputStyles, className)}
      ref={ref}
      {...props}
    />
  )
);
Input.displayName = 'Input';
