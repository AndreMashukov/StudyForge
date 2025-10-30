import { cn } from "../../../lib/utils";

export const documentsPageStyles = {
  container: "max-w-6xl mx-auto space-y-4 md:space-y-6 pb-6",
  header: "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-4 md:px-6",
  headerContent: "space-y-1",
  title: "text-2xl md:text-3xl font-bold text-foreground truncate",
  subtitle: "text-sm md:text-base text-muted-foreground",
  createButton: "flex items-center gap-2 w-full sm:w-auto justify-center",
  searchContainer: "flex items-center gap-4",
  documentsGrid: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4",
  documentCard: "transition-all duration-200 hover:shadow-md border overflow-visible",
  emptyState: "max-w-md mx-4 md:mx-auto"
} as const;

// For complex styling needs
export const getDocumentCardStyles = (isActive: boolean) => {
  return cn(
    documentsPageStyles.documentCard,
    isActive && "ring-2 ring-primary"
  );
};