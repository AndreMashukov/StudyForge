export const spinnerStyles = {
  size: {
    xs: 'h-4 w-4 border-2',
    sm: 'h-5 w-5 border-2',
    md: 'h-8 w-8 border-[3px]',
    lg: 'h-12 w-12 border-4',
  },
  variant: {
    default:      'border-primary border-t-transparent',
    muted:        'border-border border-t-primary',
    'on-primary': 'border-primary-foreground/30 border-t-primary-foreground',
    destructive:  'border-destructive/25 border-t-destructive',
  },
} as const;
