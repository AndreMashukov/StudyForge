import { cn } from '../../../lib/utils';

const boxBase = cn(
  'relative flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded',
  'border-2 border-input bg-background',
  'transition-all duration-150',
  'hover:border-ring/40',
  'focus-visible:outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/20',
  'peer-focus-visible:border-ring peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring/20',
);

export const checkboxStyles = {
  /** With visible label text — align to first line */
  wrapper: 'inline-flex items-start gap-2 cursor-pointer select-none',
  /** Standalone (aria-label only) — vertically center in list rows */
  wrapperStandalone: 'inline-flex items-center cursor-pointer select-none',
  wrapperDisabled: 'cursor-not-allowed opacity-50',
  box: cn(boxBase, 'mt-[1px]'),
  boxStandalone: boxBase,
  boxChecked: 'border-primary bg-primary',
  boxError: 'border-destructive hover:border-destructive',
  boxErrorChecked: 'border-destructive bg-destructive',
  checkIcon: 'h-3 w-3 text-primary-foreground',
  indeterminateIcon: 'h-[2px] w-[11px] rounded-full bg-primary-foreground',
  label: 'text-sm leading-snug text-foreground',
  description: 'text-xs text-muted-foreground mt-0.5',
} as const;
