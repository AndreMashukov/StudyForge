import { cn } from "../../lib/utils";

export const breadcrumbNavStyles = {
  container: "flex items-center gap-2 text-sm text-muted-foreground overflow-x-auto py-2",
  homeButton: "flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer",
  separator: "text-muted-foreground/50",
  segment: "hover:text-foreground transition-colors cursor-pointer whitespace-nowrap",
  currentSegment: "text-foreground font-medium",
  skeleton: "h-4 bg-muted animate-pulse rounded",
} as const;

export const getBreadcrumbClassName = (isLast: boolean) => {
  return cn(
    breadcrumbNavStyles.segment,
    isLast && breadcrumbNavStyles.currentSegment
  );
};
