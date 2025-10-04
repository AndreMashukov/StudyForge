/**
 * AttachedFilesList Styles
 */

export const attachedFilesListStyles = {
  container: "space-y-3",
  filesContainer: "space-y-2",
  contextMeter: "mt-3 p-3 border rounded-lg bg-muted/20",
  contextMeterHeader: "flex items-center justify-between mb-2",
  contextMeterTitle: "text-xs font-medium text-foreground",
  contextMeterValue: "text-xs text-muted-foreground",
  contextMeterValueWarning: "text-xs text-yellow-600 dark:text-yellow-500",
  contextMeterValueError: "text-xs text-destructive",
  progressBar: "w-full h-2 bg-muted rounded-full overflow-hidden",
  progressFill: "h-full transition-all duration-300",
  progressFillNormal: "bg-primary",
  progressFillWarning: "bg-yellow-500",
  progressFillError: "bg-destructive",
  errorText: "text-xs text-destructive mt-2",
  helpText: "text-xs text-muted-foreground mt-2",
} as const;

