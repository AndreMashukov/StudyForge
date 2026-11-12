import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
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
      <View
        accessibilityRole="tablist"
        className="h-[52px] flex-row items-center rounded-full bg-tab-bar p-1"
      >
        {items.map((item) => {
          const selected = item.value === value;
          return (
            <Pressable
              key={item.value}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => onValueChange(item.value)}
              className="h-full flex-1 flex-row items-center justify-center gap-1.5 rounded-full"
              style={selected ? styles.selectedTab : undefined}
            >
              <MaterialIcons
                name={item.icon}
                size={20}
                color={
                  selected
                    ? mobileUiColors.foreground
                    : mobileUiColors.tabBarInactive
                }
              />
              <Text
                className={cn(
                  'text-sm leading-5',
                  selected
                    ? 'font-sans-semibold text-foreground'
                    : 'font-sans-medium text-muted-foreground',
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

// Selected-tab fill and shadow go through `style`, not a toggled className: NativeWind
// crashes on native ("Couldn't find a navigation context") when a shadow class is
// added to a Pressable after its first render.
const styles = StyleSheet.create({
  selectedTab: {
    backgroundColor: mobileUiColors.background,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 2,
  },
});
