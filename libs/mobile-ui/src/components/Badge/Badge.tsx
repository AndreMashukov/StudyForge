import { Text, View } from 'react-native';
import { cn } from '../../lib/cn';
import type { IBadge } from './IBadge';

const variantClasses: Record<NonNullable<IBadge['variant']>, string> = {
  default: 'bg-primary border border-primary',
  secondary: 'bg-muted border border-border',
  destructive: 'bg-destructive border border-destructive',
  outline: 'border border-border bg-transparent',
};

export function Badge({ label, variant = 'default', className }: IBadge) {
  return (
    <View className={cn('self-start rounded-full px-2.5 py-1', variantClasses[variant], className)}>
      <Text
        className={cn(
          'text-xs leading-4 font-sans-bold uppercase tracking-widest',
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
