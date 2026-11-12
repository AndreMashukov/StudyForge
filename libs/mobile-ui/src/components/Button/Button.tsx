import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, Text } from 'react-native';
import { cn } from '../../lib/cn';
import { mobileUiColors } from '../../tokens/colors';
import type { IButton } from './IButton';

type ButtonVariant = NonNullable<IButton['variant']>;
type ButtonSize = NonNullable<IButton['size']>;

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-primary border border-primary',
  secondary: 'bg-background border border-foreground',
  destructive: 'bg-destructive border border-destructive',
  ghost: 'bg-transparent border border-transparent',
};

const disabledVariantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-outline border border-outline',
  secondary: 'bg-background border border-outline',
  destructive: 'bg-outline border border-outline',
  ghost: 'bg-transparent border border-transparent',
};

const sizeClasses: Record<ButtonSize, string> = {
  default: 'h-[50px] px-6',
  sm: 'h-10 px-4',
  lg: 'h-14 px-6',
};

const labelSizeClasses: Record<ButtonSize, string> = {
  default: 'text-lg leading-[22px]',
  sm: 'text-sm leading-[17px]',
  lg: 'text-lg leading-[22px]',
};

const iconSizes: Record<ButtonSize, number> = {
  default: 20,
  sm: 16,
  lg: 20,
};

function isFilled(variant: ButtonVariant): boolean {
  return variant === 'primary' || variant === 'destructive';
}

function getLabelColorClass(variant: ButtonVariant, disabled: boolean): string {
  if (isFilled(variant)) {
    return 'text-primary-foreground';
  }
  if (disabled) {
    return 'text-outline';
  }
  return variant === 'ghost' ? 'text-primary' : 'text-foreground';
}

function getIconColor(variant: ButtonVariant, disabled: boolean): string {
  if (isFilled(variant)) {
    return mobileUiColors.primaryForeground;
  }
  if (disabled) {
    return mobileUiColors.outline;
  }
  return variant === 'ghost' ? mobileUiColors.primary : mobileUiColors.foreground;
}

/** CrowdsNow buttons are always pills, so `shape` no longer changes the look. */
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
        disabled ? disabledVariantClasses[variant] : variantClasses[variant],
        sizeClasses[size],
        className
      )}
    >
      {icon ? (
        <MaterialIcons name={icon} size={iconSizes[size]} color={getIconColor(variant, disabled)} />
      ) : null}
      <Text
        numberOfLines={1}
        className={cn(
          'flex-shrink font-sans-bold',
          labelSizeClasses[size],
          getLabelColorClass(variant, disabled)
        )}
      >
        {label}
      </Text>
    </Pressable>
  );
}
