import { Text } from 'react-native';
import { cn } from '../../lib/cn';
import type { IFieldError } from './IFieldError';

export function FieldError({ message, className }: IFieldError) {
  if (!message) {
    return null;
  }

  return <Text className={cn('text-destructive text-xs leading-[15px] font-sans-medium mb-2', className)}>{message}</Text>;
}
