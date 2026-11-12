import { Text, View } from 'react-native';
import { cn } from '../../lib/cn';
import { Spinner } from '../Spinner/Spinner';
import type { ILoadingState } from './ILoadingState';

export function LoadingState({ message, className }: ILoadingState) {
  return (
    <View className={cn('flex-1 items-center justify-center gap-3 bg-background font-sans', className)}>
      <Spinner size="large" />
      <Text className="text-muted-foreground text-sm leading-[17px] font-sans-medium">{message}</Text>
    </View>
  );
}
