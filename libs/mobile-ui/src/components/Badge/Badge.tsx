import { Text, View } from 'react-native';
import { cn } from '../../lib/cn';
import type { IBadge } from './IBadge';

const variantClasses: Record<NonNullable<IBadge['variant']>, string> = {
  default: 'bg-primary border border-primary',
  secondary: 'bg-primary/10 border border-transparent',
  destructive: 'bg-destructive border border-destructive',
  outline: 'border border-border bg-transparent',
};

export function Badge({ label, variant = 'default', className }: IBadge) {
  return (
    <View className={cn('self-start items-center justify-center rounded-xl px-2 py-1', variantClasses[variant], className)}>
      <Text
        className={cn(
          'text-xs leading-[15px] font-sans-bold',
          variant === 'default' || variant === 'destructive'
            ? 'text-primary-foreground'
            : variant === 'secondary'
              ? 'text-primary'
              : 'text-foreground'
        )}
      >
        {label}
      </Text>
    </View>
  );
}
