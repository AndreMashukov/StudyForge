import { View } from 'react-native';
import { cn } from '../../lib/cn';
import type { IScreen } from './IScreen';

export function Screen({ children, className }: IScreen) {
  return <View className={cn('flex-1 bg-background px-5', className)}>{children}</View>;
}
