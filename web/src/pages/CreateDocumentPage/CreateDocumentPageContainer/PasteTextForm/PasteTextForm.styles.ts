export const pasteTextFormStyles = {
  container: 'space-y-6',
  formGroup: 'space-y-2',
  label: 'text-sm font-medium',
  textarea: 'w-full min-h-[200px] resize-y font-mono text-sm',
  characterCounter: 'text-sm text-muted-foreground text-right',
  characterCounterError: 'text-sm text-destructive text-right',
  helpText: 'text-sm text-muted-foreground',
  submitButton: 'w-full flex items-center justify-center gap-2',
} as const;
