import { cn } from "../../lib/utils";

export const pageStyles = {
  container: "min-h-screen bg-background flex",
  content: cn(
    "flex-1 flex flex-col transition-all duration-300",
    "overflow-hidden"
  ),
  main: cn(
    "flex-1 p-6 overflow-y-auto",
    "scrollbar-thin scrollbar-track-muted scrollbar-thumb-muted-foreground"
  ),
  header: cn(
    "sticky top-0 z-10 bg-background/80 backdrop-blur-sm",
    "border-b border-border px-6 py-4"
  ),
  title: "text-2xl font-bold text-foreground",
} as const;