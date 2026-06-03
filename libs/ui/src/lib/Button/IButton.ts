import * as React from 'react';
import { type VariantProps } from 'class-variance-authority';
import { buttonVariants } from './buttonVariants';

export interface IButton
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}
