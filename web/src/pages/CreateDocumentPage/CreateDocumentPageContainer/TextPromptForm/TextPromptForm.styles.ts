export const textPromptFormStyles = {
  container: "space-y-6",
  formGroup: "space-y-2",
  label: "text-sm font-medium",
  textarea: "w-full min-h-[120px] resize-y",
  characterCounter: "text-sm text-muted-foreground text-right",
  characterCounterError: "text-sm text-destructive text-right",
  helpText: "text-sm text-muted-foreground",
  submitButton: "w-full flex items-center justify-center gap-2",
  progressContainer: "space-y-2",
  progressBar: "w-full h-2 bg-muted rounded-full overflow-hidden",
  progressFill: "h-full bg-primary transition-all duration-300",
  progressText: "text-sm text-muted-foreground text-center",
} as const;

