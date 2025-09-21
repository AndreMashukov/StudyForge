import { cn } from "../../../lib/utils";

export const documentsPageStyles = {
  container: "max-w-6xl mx-auto space-y-6",
  header: "flex items-center justify-between",
  headerContent: "space-y-1",
  title: "text-3xl font-bold text-foreground",
  subtitle: "text-muted-foreground",
  createButton: "flex items-center gap-2",
  searchContainer: "flex items-center gap-4",
  documentsGrid: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4",
  documentCard: "transition-all duration-200 hover:shadow-md border",
  emptyState: "max-w-md mx-auto"
} as const;

// For complex styling needs
export const getDocumentCardStyles = (isActive: boolean) => {
  return cn(
    documentsPageStyles.documentCard,
    isActive && "ring-2 ring-primary"
  );
};