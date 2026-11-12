import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Heading } from '../Heading/Heading';
import { cn } from '../../lib/cn';
import type { IScreenHeader } from './IScreenHeader';

export function ScreenHeader({ title, leading, trailing, className }: IScreenHeader) {
  return (
    <SafeAreaView
      edges={['top']}
      className={cn(
        '-mx-container bg-background',
        className
      )}
    >
      <View className="h-14 flex-row items-center justify-between px-container">
        <View className="flex-1 flex-row items-center gap-1">
          {leading}
          <Heading level={3} numberOfLines={1} className="flex-shrink">
            {title}
          </Heading>
        </View>
        {trailing ? <View className="flex-row items-center">{trailing}</View> : null}
      </View>
    </SafeAreaView>
  );
}
