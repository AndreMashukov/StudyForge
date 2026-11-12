import { fieldStyles } from '../Field/fieldStyles';

export const selectTriggerStyles =
  fieldStyles +
  ' justify-between gap-2 [&>span]:line-clamp-1 ' +
  'data-[placeholder]:text-muted-foreground ' +
  'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50';

export const selectContentStyles =
  'relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-2xl border border-border/60 ' +
  'bg-[rgb(var(--dropdown))] text-[rgb(var(--popover-foreground))] shadow-[0_8px_24px_rgb(0_0_0/0.14)] ' +
  'data-[state=open]:animate-in data-[state=closed]:animate-out ' +
  'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 ' +
  'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 ' +
  'data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 ' +
  'data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2';

export const selectContentPopperStyles =
  'data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 ' +
  'data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1';

export const selectViewportPopperStyles =
  'w-full min-w-[var(--radix-select-trigger-width)]';

export const selectItemStyles =
  'relative flex w-full cursor-default select-none items-center rounded-lg py-2 pl-8 pr-3 ' +
  'text-sm outline-none transition-colors ' +
  'focus:bg-foreground/[0.07] focus:text-foreground ' +
  'data-[highlighted]:bg-foreground/[0.07] data-[highlighted]:text-foreground ' +
  'data-[disabled]:pointer-events-none data-[disabled]:opacity-50';

export const selectLabelStyles =
  'px-3 py-1.5 text-xs font-medium text-muted-foreground';

export const selectSeparatorStyles = '-mx-1.5 my-1.5 h-px bg-border/60';

export const selectScrollButtonStyles =
  'flex cursor-default items-center justify-center py-1 text-muted-foreground';
