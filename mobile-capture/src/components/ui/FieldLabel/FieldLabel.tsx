import { Text } from 'react-native';
import type { IFieldLabel } from './IFieldLabel';

export function FieldLabel({ children }: IFieldLabel) {
  return <Text className="text-foreground text-sm font-semibold mb-1">{children}</Text>;
}
