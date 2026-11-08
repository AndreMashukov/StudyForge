import { cn } from "../../lib/utils";

export const breadcrumbNavStyles = {
  container: "flex min-w-0 max-w-full flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground py-2",
  homeButton: "flex shrink-0 items-center gap-1 hover:text-foreground transition-colors cursor-pointer",
  separator: "text-muted-foreground/50 shrink-0",
  segment: "min-w-0 hover:text-foreground transition-colors cursor-pointer break-words text-left",
  currentSegment: "text-foreground font-medium",
  skeleton: "h-4 bg-muted animate-pulse rounded",
} as const;

export const getBreadcrumbClassName = (isLast: boolean) => {
  return cn(
    breadcrumbNavStyles.segment,
    isLast && breadcrumbNavStyles.currentSegment
  );
};
