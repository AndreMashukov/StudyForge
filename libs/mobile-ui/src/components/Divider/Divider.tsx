import { View } from 'react-native';
import { cn } from '../../lib/cn';

export interface IDivider {
  className?: string;
  orientation?: 'horizontal' | 'vertical';
}

export function Divider({ className, orientation = 'horizontal' }: IDivider) {
  return (
    <View
      className={cn(
        'bg-border',
        orientation === 'horizontal' ? 'h-px w-full my-3' : 'w-px h-full mx-3',
        className
      )}
    />
  );
}
