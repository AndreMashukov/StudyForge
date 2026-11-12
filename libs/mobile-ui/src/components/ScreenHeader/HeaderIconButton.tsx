import { MaterialIcons } from '@expo/vector-icons';
import { Pressable } from 'react-native';
import { mobileUiColors } from '../../tokens/colors';
import { cn } from '../../lib/cn';
import type { IHeaderIconButton } from './IHeaderIconButton';

export function HeaderIconButton({
  icon,
  accessibilityLabel,
  onPress,
  className,
}: IHeaderIconButton) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      className={cn('h-10 w-10 items-center justify-center', className)}
    >
      <MaterialIcons name={icon} size={24} color={mobileUiColors.primaryForeground} />
    </Pressable>
  );
}
