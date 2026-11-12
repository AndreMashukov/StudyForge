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
        '-mx-container rounded-b-[25px] bg-primary',
        className
      )}
    >
      <View className="min-h-12 flex-row items-center justify-between px-container pb-6 pt-2">
        <View className="flex-1 flex-row items-center gap-2">
          {leading}
          <Heading level={2} numberOfLines={1} className="flex-shrink text-primary-foreground">
            {title}
          </Heading>
        </View>
        {trailing ? <View className="flex-row items-center">{trailing}</View> : null}
      </View>
    </SafeAreaView>
  );
}
