import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import { mobileUiColors } from '../../tokens/colors';
import { cn } from '../../lib/cn';
import type { ICheckbox } from './ICheckbox';

export function Checkbox({
  checked,
  onCheckedChange,
  label,
  disabled,
  className,
}: ICheckbox) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      onPress={() => onCheckedChange(!checked)}
      className={cn('min-h-12 flex-row items-center gap-3', disabled && 'opacity-50', className)}
    >
      <View
        className={cn(
          'h-[22px] w-[22px] items-center justify-center rounded-full border-2',
          checked ? 'border-primary bg-primary' : 'border-outline-variant bg-background'
        )}
      >
        {checked ? <MaterialIcons name="check" size={14} color={mobileUiColors.primaryForeground} /> : null}
      </View>
      <Text className="text-foreground text-base leading-6 font-sans">{label}</Text>
    </Pressable>
  );
}
