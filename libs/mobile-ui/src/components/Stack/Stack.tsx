import type { ReactNode } from 'react';
import { View, type ViewProps } from 'react-native';
import { cn } from '../../lib/cn';

export interface IStack extends ViewProps {
  children: ReactNode;
  direction?: 'vertical' | 'horizontal';
  gap?: 'none' | 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

const gapClasses: Record<NonNullable<IStack['gap']>, string> = {
  none: 'gap-0',
  xs: 'gap-1',
  sm: 'gap-2',
  md: 'gap-3',
  lg: 'gap-5',
};

export function Stack({
  children,
  direction = 'vertical',
  gap = 'sm',
  className,
  ...props
}: IStack) {
  return (
    <View
      className={cn(
        direction === 'horizontal' ? 'flex-row items-center' : 'flex-col',
        gapClasses[gap],
        className
      )}
      {...props}
    >
      {children}
    </View>
  );
}
