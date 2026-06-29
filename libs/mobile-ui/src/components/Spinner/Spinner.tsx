import { ActivityIndicator, type ActivityIndicatorProps } from 'react-native';
import { mobileUiColors } from '../../tokens/colors';
import { cn } from '../../lib/cn';

export interface ISpinner extends Pick<ActivityIndicatorProps, 'size'> {
  className?: string;
}

export function Spinner({ size = 'small', className }: ISpinner) {
  return (
    <ActivityIndicator
      size={size}
      color={mobileUiColors.primary}
      className={cn(className)}
    />
  );
}
