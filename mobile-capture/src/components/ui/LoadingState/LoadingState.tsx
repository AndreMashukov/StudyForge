import { ActivityIndicator, Text, View } from 'react-native';
import type { ILoadingState } from './ILoadingState';

export function LoadingState({ message }: ILoadingState) {
  return (
    <View className="flex-1 items-center justify-center gap-3 bg-background">
      <ActivityIndicator size="large" color="#8b5cf6" />
      <Text className="text-muted-foreground text-base">{message}</Text>
    </View>
  );
}
