import { Text } from 'react-native';
import { cn } from '../../lib/cn';
import type { IFieldLabel } from './IFieldLabel';

export function FieldLabel({ children, className }: IFieldLabel) {
  return (
    <Text className={cn('text-foreground/50 text-sm leading-[17px] font-sans-medium mb-1', className)}>
      {children}
    </Text>
  );
}
