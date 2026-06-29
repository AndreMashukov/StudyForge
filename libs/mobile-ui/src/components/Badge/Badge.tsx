import { Text, View } from 'react-native';
import { cn } from '../../lib/cn';
import type { IBadge } from './IBadge';

const variantClasses: Record<NonNullable<IBadge['variant']>, string> = {
  default: 'bg-primary',
  secondary: 'bg-muted border border-border',
  destructive: 'bg-destructive',
  outline: 'border border-border bg-transparent',
};

export function Badge({ label, variant = 'default', className }: IBadge) {
  return (
    <View className={cn('self-start rounded-full px-2.5 py-1', variantClasses[variant], className)}>
      <Text
        className={cn(
          'text-xs font-semibold',
          variant === 'default' || variant === 'destructive'
            ? 'text-primary-foreground'
            : 'text-foreground'
        )}
      >
        {label}
      </Text>
    </View>
  );
}
