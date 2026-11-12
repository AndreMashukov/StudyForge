import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, Text } from 'react-native';
import { cn } from '../../lib/cn';
import { mobileUiColors } from '../../tokens/colors';
import type { IButton } from './IButton';

type ButtonVariant = NonNullable<IButton['variant']>;
type ButtonSize = NonNullable<IButton['size']>;

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-primary',
  secondary: 'bg-muted',
  destructive: 'bg-muted',
  ghost: 'bg-transparent',
};

const labelColorClasses: Record<ButtonVariant, string> = {
  primary: 'text-primary-foreground',
  secondary: 'text-foreground',
  destructive: 'text-destructive',
  ghost: 'text-foreground',
};

const iconColors: Record<ButtonVariant, string> = {
  primary: mobileUiColors.primaryForeground,
  secondary: mobileUiColors.foreground,
  destructive: mobileUiColors.destructive,
  ghost: mobileUiColors.foreground,
};

const sizeClasses: Record<ButtonSize, string> = {
  default: 'h-[52px] px-6',
  sm: 'h-10 px-4',
  lg: 'h-14 px-6',
};

const labelSizeClasses: Record<ButtonSize, string> = {
  default: 'text-base leading-6',
  sm: 'text-sm leading-5',
  lg: 'text-[17px] leading-6',
};

const iconSizes: Record<ButtonSize, number> = {
  default: 20,
  sm: 16,
  lg: 20,
};

/** Buttons are always pills, so `shape` no longer changes the look. */
export function Button({
  label,
  onPress,
  disabled = false,
  variant = 'primary',
  size = 'default',
  icon,
  className,
}: IButton) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      className={cn(
        'flex-row items-center justify-center gap-2 rounded-full',
        variantClasses[variant],
        sizeClasses[size],
        disabled && 'opacity-40',
        className
      )}
    >
      {icon ? <MaterialIcons name={icon} size={iconSizes[size]} color={iconColors[variant]} /> : null}
      <Text
        numberOfLines={1}
        className={cn('flex-shrink font-sans-semibold', labelSizeClasses[size], labelColorClasses[variant])}
      >
        {label}
      </Text>
    </Pressable>
  );
}
