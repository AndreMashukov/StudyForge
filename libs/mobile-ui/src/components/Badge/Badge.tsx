import { Text, View } from 'react-native';
import { cn } from '../../lib/cn';
import type { IBadge } from './IBadge';

const variantClasses: Record<NonNullable<IBadge['variant']>, string> = {
  default: 'bg-primary border border-primary',
  secondary: 'bg-muted border border-transparent',
  destructive: 'bg-error-container border border-transparent',
  outline: 'border border-border bg-transparent',
};

export function Badge({ label, variant = 'default', className }: IBadge) {
  return (
    <View className={cn('self-start items-center justify-center rounded-full px-2.5 py-1', variantClasses[variant], className)}>
      <Text
        className={cn(
          'text-xs leading-4 font-sans-medium',
          variant === 'default'
            ? 'text-primary-foreground'
            : variant === 'destructive'
              ? 'text-on-error-container'
              : 'text-foreground'
        )}
      >
        {label}
      </Text>
    </View>
  );
}
