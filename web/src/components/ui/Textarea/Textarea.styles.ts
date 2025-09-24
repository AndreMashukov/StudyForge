import { cn } from "../../../lib/utils";

export const textareaStyles = {
  container: "space-y-2",
  label: "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
  textarea: cn(
    "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
    "ring-offset-background placeholder:text-muted-foreground",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    "disabled:cursor-not-allowed disabled:opacity-50",
    "resize-vertical"
  ),
  textareaError: "border-destructive focus-visible:ring-destructive",
  error: "text-sm text-destructive",
  helperText: "text-sm text-muted-foreground",
  charCount: "text-xs text-muted-foreground text-right",
  charCountOver: "text-xs text-destructive text-right",
} as const;