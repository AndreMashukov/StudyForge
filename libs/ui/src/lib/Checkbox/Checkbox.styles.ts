import { cn } from '../utils';

const boxBase = cn(
  'relative flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-[6px]',
  'border-[1.5px] border-foreground/30 bg-transparent',
  'transition-all duration-150',
  'hover:border-foreground/50',
  'peer-focus-visible:border-ring peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring/25',
);

/**
 * `relative` anchors the visually hidden native input to the checkbox itself.
 * Without it the `sr-only` input is positioned against the nearest positioned
 * ancestor (e.g. a dialog) and ignores intermediate scroll containers, so
 * focusing it on click scrolls that ancestor and shifts the whole layout.
 */
const wrapperBase = 'relative inline-flex cursor-pointer select-none';

export const checkboxStyles = {
  /** With visible label text — align to first line */
  wrapper: cn(wrapperBase, 'items-start gap-2'),
  /** Standalone (aria-label only) — vertically center in list rows */
  wrapperStandalone: cn(wrapperBase, 'items-center'),
  wrapperDisabled: 'cursor-not-allowed opacity-50',
  box: cn(boxBase, 'mt-[1px]'),
  boxStandalone: boxBase,
  boxChecked: 'border-primary bg-primary hover:border-primary',
  boxError: 'border-destructive hover:border-destructive',
  boxErrorChecked: 'border-destructive bg-destructive hover:border-destructive',
  checkIcon: 'h-3 w-3 text-primary-foreground',
  indeterminateIcon: 'h-[2px] w-[11px] rounded-full bg-primary-foreground',
  text: 'flex min-w-0 flex-col',
  label: 'text-sm leading-snug text-foreground',
  description: 'mt-0.5 text-xs text-muted-foreground',
} as const;
