/**
 * Styles for the Input component.
 */
export const inputStyles = {
  base: [
    "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
    "file:border-0 file:bg-transparent file:text-sm file:font-medium",
    "placeholder:text-muted-foreground",
    "transition-all duration-150",
    "hover:border-ring/40",
    "focus-visible:outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/20",
    "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-muted",
  ].join(" "),
} as const;