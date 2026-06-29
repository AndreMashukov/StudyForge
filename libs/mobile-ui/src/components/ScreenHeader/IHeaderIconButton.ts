import type { MaterialIcons } from '@expo/vector-icons';

export interface IHeaderIconButton {
  icon: keyof typeof MaterialIcons.glyphMap;
  accessibilityLabel: string;
  onPress: () => void;
  className?: string;
}
