import { cn } from '../../../lib/utils';
import { ClusterLoader } from '../../ClusterLoader';
import { ISpinner } from './ISpinner';
import { spinnerStyles } from './Spinner.styles';

export const Spinner = ({ size = 'md', variant = 'default', className }: ISpinner) => {
  if (size === 'md' || size === 'lg') {
    return <ClusterLoader size={size} className={className} label="Loading" />;
  }

  return (
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
};

Spinner.displayName = 'Spinner';
