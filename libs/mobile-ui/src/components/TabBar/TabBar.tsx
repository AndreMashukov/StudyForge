import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { cn } from '../../lib/cn';
import { mobileUiColors } from '../../tokens/colors';
import type { ITabBar } from './ITabBar';

const MIN_BOTTOM_GAP = 12;

/** Floating segmented pill tab bar that stays above the system navigation bar. */
export function TabBar<TValue extends string>({
  items,
  value,
  onValueChange,
  className,
}: ITabBar<TValue>) {
  const insets = useSafeAreaInsets();

  return (
    <View
      className={cn('bg-background px-5 pt-2', className)}
      style={{ paddingBottom: Math.max(insets.bottom, MIN_BOTTOM_GAP) }}
    >
      <View accessibilityRole="tablist" className="h-[52px] flex-row items-center rounded-full bg-tab-bar p-1">
        {items.map((item) => {
          const selected = item.value === value;
          return (
            <Pressable
              key={item.value}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => onValueChange(item.value)}
              className={cn(
                'h-full flex-1 flex-row items-center justify-center gap-1.5 rounded-full',
                selected && 'bg-background shadow-raised'
              )}
            >
              <MaterialIcons
                name={item.icon}
                size={20}
                color={selected ? mobileUiColors.foreground : mobileUiColors.tabBarInactive}
              />
              <Text
                className={cn(
                  'text-sm leading-5',
                  selected ? 'font-sans-semibold text-foreground' : 'font-sans-medium text-muted-foreground'
                )}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
