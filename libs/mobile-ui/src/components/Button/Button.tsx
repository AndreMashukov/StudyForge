import { Pressable, Text } from 'react-native';
import { cn } from '../../lib/cn';
import type { IButton } from './IButton';

const variantClasses: Record<NonNullable<IButton['variant']>, string> = {
  primary: 'bg-primary',
  secondary: 'bg-muted border border-border',
  destructive: 'bg-destructive',
  ghost: 'bg-transparent',
};

const sizeClasses: Record<NonNullable<IButton['size']>, string> = {
  default: 'px-4 py-3.5',
  sm: 'px-3 py-2.5',
  lg: 'px-5 py-4',
};

export function Button({
  label,
  onPress,
  disabled,
  variant = 'primary',
  size = 'default',
  className,
}: IButton) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      className={cn(
        'rounded-xl items-center',
        variantClasses[variant],
        sizeClasses[size],
        disabled && 'opacity-50',
        className
      )}
    >
      <Text
        className={cn(
          'text-base font-semibold',
          variant === 'primary' || variant === 'destructive'
            ? 'text-primary-foreground'
            : 'text-foreground'
        )}
      >
        {label}
      </Text>
    </Pressable>
  );
}
