import { Pressable, Text } from 'react-native';
import { cn } from '../../lib/cn';
import type { IButton } from './IButton';

const variantClasses: Record<NonNullable<IButton['variant']>, string> = {
  primary: 'bg-primary border border-primary',
  secondary: 'bg-card border border-border',
  destructive: 'bg-destructive border border-destructive',
  ghost: 'bg-transparent border border-transparent',
};

const sizeClasses: Record<NonNullable<IButton['size']>, string> = {
  default: 'min-h-12 px-4 py-3',
  sm: 'min-h-10 px-3 py-2',
  lg: 'min-h-14 px-5 py-4',
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
        'rounded-lg items-center justify-center',
        variantClasses[variant],
        sizeClasses[size],
        disabled && 'opacity-50',
        className
      )}
    >
      <Text
        className={cn(
          'text-base font-sans-semibold',
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
