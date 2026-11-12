import { Text } from 'react-native';
import { cn } from '../../lib/cn';
import type { IHeading } from './IHeading';

const levelClasses: Record<NonNullable<IHeading['level']>, string> = {
  1: 'text-[28px] leading-[34px] font-sans-semibold tracking-tight',
  2: 'text-[22px] leading-7 font-sans-semibold tracking-tight',
  3: 'text-lg leading-6 font-sans-semibold',
  4: 'text-base leading-6 font-sans-semibold',
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
