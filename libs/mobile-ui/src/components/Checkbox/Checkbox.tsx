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
      className={cn('min-h-12 flex-row items-center gap-3', disabled && 'opacity-50', className)}
    >
      <View
        className={cn(
          'h-5 w-5 items-center justify-center rounded-sm border border-border',
          checked && 'bg-primary border-primary'
        )}
      >
        {checked ? <Text className="text-primary-foreground text-xs font-sans-bold">✓</Text> : null}
      </View>
      <Text className="text-foreground text-base font-sans">{label}</Text>
    </Pressable>
  );
}
