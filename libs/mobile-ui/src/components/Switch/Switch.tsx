import { Pressable, Text, View } from 'react-native';
import { cn } from '../../lib/cn';
import type { ISwitch } from './ISwitch';

export function Switch({ value, onValueChange, label, disabled, className }: ISwitch) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={() => onValueChange(!value)}
      className={cn(
        'min-h-12 flex-row items-center justify-between gap-4',
        disabled && 'opacity-50',
        className
      )}
    >
      <Text className="text-foreground text-base font-sans flex-1">{label}</Text>
      <View
        className={cn(
          'h-7 w-12 rounded-full border border-border p-0.5',
          value ? 'bg-primary border-primary' : 'bg-input'
        )}
      >
        <View
          className={cn(
            'h-5 w-5 rounded-full bg-foreground',
            value ? 'ml-auto' : 'mr-auto'
          )}
        />
      </View>
    </Pressable>
  );
}
