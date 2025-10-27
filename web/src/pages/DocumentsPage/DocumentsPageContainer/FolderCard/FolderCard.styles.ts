import { cn } from "../../../../lib/utils";

export const folderCardStyles = {
  gridCard: "group relative flex flex-col gap-3 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer",
  listCard: "group relative flex flex-row items-center gap-4 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer",
  iconContainer: "flex items-center justify-center",
  gridIcon: "w-12 h-12",
  listIcon: "w-8 h-8",
  content: "flex-1 min-w-0",
  title: "font-medium text-foreground truncate",
  metadata: "flex items-center gap-2 text-sm text-muted-foreground mt-1",
  count: "flex items-center gap-1",
  actions: "absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1",
} as const;

export const getFolderCardClassName = (viewMode: "grid" | "list") => {
  return cn(viewMode === "grid" ? folderCardStyles.gridCard : folderCardStyles.listCard);
};

export const getIconClassName = (viewMode: "grid" | "list") => {
  return cn(
    folderCardStyles.iconContainer,
    viewMode === "grid" ? folderCardStyles.gridIcon : folderCardStyles.listIcon
  );
};
