export const createQuizPageStyles = {
  container: "min-h-screen bg-background",
  header: "sticky top-0 bg-background border-b px-6 py-4",
  headerContent: "max-w-4xl mx-auto flex items-center justify-between",
  title: "text-2xl font-bold text-foreground",
  backButton: "flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors",
  content: "max-w-2xl mx-auto p-6",
  formCard: "p-6 space-y-6",
  formField: "space-y-2",
  formActions: "flex gap-3 pt-4",
  submitButton: "flex-1",
  cancelButton: "flex-1",
} as const;