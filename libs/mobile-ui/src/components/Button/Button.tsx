import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, Text } from 'react-native';
import { cn } from '../../lib/cn';
import { mobileUiColors } from '../../tokens/colors';
import type { IButton } from './IButton';

const variantClasses: Record<NonNullable<IButton['variant']>, string> = {
  primary: 'bg-primary border border-primary',
  secondary: 'bg-card border border-border',
  destructive: 'bg-error-container border border-transparent',
  ghost: 'bg-transparent border border-transparent',
};

const sizeClasses: Record<NonNullable<IButton['size']>, string> = {
  default: 'min-h-12 px-4 py-3',
  sm: 'min-h-10 px-4 py-2',
  lg: 'min-h-14 px-5 py-4',
};

const shapeClasses: Record<NonNullable<IButton['shape']>, string> = {
  default: 'rounded-lg',
  pill: 'rounded-full',
};

const labelSizeClasses: Record<NonNullable<IButton['size']>, string> = {
  default: 'text-base',
  sm: 'text-sm',
  lg: 'text-base',
};

function getLabelColorClass(variant: NonNullable<IButton['variant']>): string {
  if (variant === 'primary') {
    return 'text-primary-foreground';
  }
  if (variant === 'destructive') {
    return 'text-on-error-container';
  }
  return 'text-foreground';
}

function getIconColor(variant: NonNullable<IButton['variant']>): string {
  if (variant === 'primary') {
    return mobileUiColors.primaryForeground;
  }
  if (variant === 'destructive') {
    return mobileUiColors.onErrorContainer;
  }
  return mobileUiColors.foreground;
}

export function Button({
  label,
  onPress,
  disabled,
  variant = 'primary',
  size = 'default',
  shape = 'default',
  icon,
  className,
}: IButton) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      className={cn(
        'flex-row items-center justify-center gap-1',
        shapeClasses[shape],
        variantClasses[variant],
        sizeClasses[size],
        disabled && 'opacity-50',
        className
      )}
    >
      {icon ? <MaterialIcons name={icon} size={18} color={getIconColor(variant)} /> : null}
      <Text className={cn('font-sans-semibold', labelSizeClasses[size], getLabelColorClass(variant))}>
        {label}
      </Text>
    </Pressable>
  );
}
