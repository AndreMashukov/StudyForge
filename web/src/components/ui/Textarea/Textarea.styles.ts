import { cn } from "../../../lib/utils";

export const textareaStyles = {
  container: "space-y-2",
  label: "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
  textarea: cn(
    "flex min-h-[80px] w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground ring-offset-background",
    "placeholder:text-muted-foreground",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
    "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-muted",
    "dark:bg-[rgb(44_40_51)] hover:border-primary/50 hover:bg-foreground/5",
    "resize-vertical"
  ),
  textareaError: "border-destructive hover:border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20",
  error: "text-sm text-destructive",
  helperText: "text-sm text-muted-foreground",
  charCount: "text-xs text-muted-foreground text-right",
  charCountOver: "text-xs text-destructive text-right",
} as const;