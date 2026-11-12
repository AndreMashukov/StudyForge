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
      <Text className="text-foreground text-sm leading-[17px] font-sans flex-1">{label}</Text>
      <View
        className={cn(
          'h-[31px] w-[51px] justify-center rounded-full p-0.5',
          value ? 'bg-accent' : 'bg-switch-off'
        )}
      >
        <View
          className={cn(
            'h-[27px] w-[27px] rounded-full bg-primary-foreground',
            value ? 'ml-auto' : 'mr-auto'
          )}
        />
      </View>
    </Pressable>
  );
}
