import { Pressable, Text, View } from 'react-native';
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
      className={cn('min-h-12 flex-row items-center gap-2.5', disabled && 'opacity-50', className)}
    >
      <View className="h-4 w-4 items-center justify-center border border-primary">
        {checked ? <View className="h-2 w-2 bg-primary" /> : null}
      </View>
      <Text className="text-foreground text-sm leading-[17px] font-sans">{label}</Text>
    </Pressable>
  );
}
