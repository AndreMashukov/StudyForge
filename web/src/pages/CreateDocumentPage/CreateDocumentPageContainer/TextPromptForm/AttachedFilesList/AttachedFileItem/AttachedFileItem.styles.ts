/**
 * AttachedFileItem Styles
 */

export const attachedFileItemStyles = {
  container: "flex items-center justify-between p-3 border rounded-lg bg-card transition-colors",
  fileInfo: "flex-1 flex items-center gap-3 min-w-0",
  icon: "flex-shrink-0 w-4 h-4",
  iconReady: "text-green-500",
  iconReading: "text-blue-500 animate-spin",
  iconError: "text-destructive",
  fileDetails: "flex-1 min-w-0",
  fileName: "text-sm font-medium text-foreground truncate",
  fileMeta: "flex items-center gap-2 mt-0.5",
  fileSize: "text-xs text-muted-foreground",
  fileTokens: "text-xs text-muted-foreground",
  separator: "text-xs text-muted-foreground",
  errorText: "text-xs text-destructive mt-0.5",
  removeButton: "flex-shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded p-1.5 transition-colors",
  removeIcon: "w-4 h-4",
} as const;

