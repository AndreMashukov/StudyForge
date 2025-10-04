/**
 * FileUploadZone Styles
 */

export const fileUploadZoneStyles = {
  container: "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all duration-200",
  containerIdle: "border-input hover:border-primary hover:bg-primary/5",
  containerDragging: "border-primary bg-primary/10",
  containerDisabled: "opacity-50 cursor-not-allowed border-muted",
  inner: "flex flex-col items-center gap-3",
  icon: "w-10 h-10 text-muted-foreground",
  title: "text-sm font-medium text-foreground",
  description: "text-xs text-muted-foreground",
  helpText: "text-xs text-muted-foreground mt-1",
  input: "hidden",
} as const;

