import { cn } from '../../../lib/utils';
import { ISpinner } from './ISpinner';
import { spinnerStyles } from './Spinner.styles';

export const Spinner = ({ size = 'md', variant = 'default', className }: ISpinner) => (
  <div
    role="status"
    aria-label="Loading"
    className={cn(
      'animate-spin rounded-full shrink-0',
      spinnerStyles.size[size],
      spinnerStyles.variant[variant],
      className,
    )}
  />
);

Spinner.displayName = 'Spinner';
