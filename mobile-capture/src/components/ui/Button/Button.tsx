import { Pressable, Text } from 'react-native';
import { cn } from '../../../lib/utils/cn';
import type { IButton } from './IButton';

export function Button({
  label,
  onPress,
  disabled,
  variant = 'primary',
  className,
}: IButton) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      className={cn(
        'rounded-xl px-4 py-3.5 items-center',
        variant === 'primary' && 'bg-primary',
        variant === 'secondary' && 'bg-muted border border-border',
        variant === 'destructive' && 'bg-destructive',
        disabled && 'opacity-50',
        className
      )}
    >
      <Text className="text-base font-semibold text-foreground">{label}</Text>
    </Pressable>
  );
}
