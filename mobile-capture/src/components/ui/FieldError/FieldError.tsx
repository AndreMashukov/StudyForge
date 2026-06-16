import { Text } from 'react-native';
import type { IFieldError } from './IFieldError';

export function FieldError({ message }: IFieldError) {
  if (!message) {
    return null;
  }
  return <Text className="text-destructive text-sm mb-2">{message}</Text>;
}
