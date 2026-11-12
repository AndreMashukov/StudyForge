import type { MaterialIcons } from '@expo/vector-icons';

export interface ITabBarItem<TValue extends string> {
  value: TValue;
  label: string;
  icon: keyof typeof MaterialIcons.glyphMap;
}

export interface ITabBar<TValue extends string> {
  items: ReadonlyArray<ITabBarItem<TValue>>;
  value: TValue;
  onValueChange: (value: TValue) => void;
  className?: string;
}
