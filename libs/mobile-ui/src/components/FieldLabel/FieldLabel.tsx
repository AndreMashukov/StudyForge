import { Text } from 'react-native';
import { cn } from '../../lib/cn';
import type { IFieldLabel } from './IFieldLabel';

export function FieldLabel({ children, className }: IFieldLabel) {
  return (
    <Text className={cn('text-foreground text-sm leading-5 font-sans-semibold mb-1', className)}>
      {children}
    </Text>
  );
}
