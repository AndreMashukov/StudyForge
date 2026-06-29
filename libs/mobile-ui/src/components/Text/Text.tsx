import { Text as RNText } from 'react-native';
import { cn } from '../../lib/cn';
import type { IText } from './IText';

const variantClasses: Record<NonNullable<IText['variant']>, string> = {
  body: 'text-base',
  caption: 'text-sm',
  label: 'text-xs font-semibold uppercase tracking-wider',
};

const toneClasses: Record<NonNullable<IText['tone']>, string> = {
  default: 'text-foreground',
  muted: 'text-muted-foreground',
  primary: 'text-primary',
  destructive: 'text-destructive',
  accent: 'text-accent',
};

export function Text({
  children,
  variant = 'body',
  tone = 'default',
  className,
  ...props
}: IText) {
  return (
    <RNText className={cn(variantClasses[variant], toneClasses[tone], className)} {...props}>
      {children}
    </RNText>
  );
}
