/** Same soft-gray field surface as Input, with a rounded-rectangle shape for multi-line text. */
export const textareaStyles = {
  container: 'space-y-2',
  label:
    'text-sm font-medium leading-none text-foreground peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
  textarea:
    'flex min-h-[80px] w-full resize-y rounded-2xl border border-transparent bg-input px-4 py-3 text-sm text-foreground ring-offset-background transition-colors ' +
    'placeholder:text-muted-foreground ' +
    'hover:border-border ' +
    'focus-visible:outline-none focus-visible:border-primary/60 focus-visible:ring-2 focus-visible:ring-primary/30 ' +
    'disabled:cursor-not-allowed disabled:opacity-50',
  textareaError:
    'border-destructive hover:border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20',
  error: 'text-sm text-destructive',
  helperText: 'text-sm text-muted-foreground',
  charCount: 'text-right text-xs text-muted-foreground',
  charCountOver: 'text-right text-xs text-destructive',
} as const;
