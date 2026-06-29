import { Text } from 'react-native';
import { cn } from '../../lib/cn';
import type { IHeading } from './IHeading';

const levelClasses: Record<NonNullable<IHeading['level']>, string> = {
  1: 'text-3xl font-bold',
  2: 'text-2xl font-bold',
  3: 'text-xl font-semibold',
  4: 'text-lg font-semibold',
};

export function Heading({ children, level = 1, className, ...props }: IHeading) {
  return (
    <Text
      accessibilityRole="header"
      className={cn('text-foreground', levelClasses[level], className)}
      {...props}
    >
      {children}
    </Text>
  );
}
