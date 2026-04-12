import { cn } from "../../../lib/utils";

export const textareaStyles = {
  container: "space-y-2",
  label: "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
  textarea: cn(
    "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
    "placeholder:text-muted-foreground",
    "transition-all duration-150",
    "hover:border-ring/40",
    "focus-visible:outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/20",
    "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-muted",
    "resize-vertical"
  ),
  textareaError: "border-destructive hover:border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20",
  error: "text-sm text-destructive",
  helperText: "text-sm text-muted-foreground",
  charCount: "text-xs text-muted-foreground text-right",
  charCountOver: "text-xs text-destructive text-right",
} as const;