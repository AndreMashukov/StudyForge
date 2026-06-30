import type { MaterialIcons } from '@expo/vector-icons';

export interface IButton {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'destructive' | 'ghost';
  size?: 'default' | 'sm' | 'lg';
  shape?: 'default' | 'pill';
  icon?: keyof typeof MaterialIcons.glyphMap;
  className?: string;
}
