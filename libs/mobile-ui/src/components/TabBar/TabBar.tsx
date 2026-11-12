import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { cn } from '../../lib/cn';
import { mobileUiColors } from '../../tokens/colors';
import type { ITabBar } from './ITabBar';

const MIN_BOTTOM_GAP = 12;

/** Floating black pill tab bar that stays above the system navigation bar. */
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
      <View accessibilityRole="tablist" className="h-[51px] flex-row items-center rounded-[41px] bg-tab-bar px-2">
        {items.map((item) => {
          const selected = item.value === value;
          return (
            <Pressable
              key={item.value}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => onValueChange(item.value)}
              className="h-full flex-1 flex-row items-center justify-center gap-1.5"
            >
              <MaterialIcons
                name={item.icon}
                size={20}
                color={selected ? mobileUiColors.primaryForeground : mobileUiColors.tabBarInactive}
              />
              <Text
                className={cn(
                  'text-xs leading-[15px] font-sans-bold',
                  selected ? 'text-primary-foreground' : 'text-outline'
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
