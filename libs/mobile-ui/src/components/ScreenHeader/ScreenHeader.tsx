import { View } from 'react-native';
import { Heading } from '../Heading/Heading';
import { cn } from '../../lib/cn';
import type { IScreenHeader } from './IScreenHeader';

export function ScreenHeader({ title, leading, trailing, className }: IScreenHeader) {
  return (
    <View
      className={cn(
        '-mx-container px-container h-12 flex-row items-center justify-between border-b border-outline-variant bg-background',
        className
      )}
    >
      <View className="flex-1 flex-row items-center gap-4">
        {leading}
        <Heading level={2} numberOfLines={1} className="flex-shrink text-primary">
          {title}
        </Heading>
      </View>
      {trailing ? <View className="flex-row items-center">{trailing}</View> : null}
    </View>
  );
}
