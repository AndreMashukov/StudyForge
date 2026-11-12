import { Text } from 'react-native';
import { cn } from '../../lib/cn';
import type { IHeading } from './IHeading';

const levelClasses: Record<NonNullable<IHeading['level']>, string> = {
  1: 'text-[32px] leading-[39px] font-sans-bold',
  2: 'text-2xl leading-[29px] font-sans-bold',
  3: 'text-lg leading-[22px] font-sans-bold',
  4: 'text-base leading-5 font-sans-bold',
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
