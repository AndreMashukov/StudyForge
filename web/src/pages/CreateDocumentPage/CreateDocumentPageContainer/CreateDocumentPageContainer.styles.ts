export const createDocumentPageStyles = {
  container: "max-w-6xl mx-auto space-y-6 p-6",
  header: "space-y-4",
  headerContent: "space-y-2",
  title: "text-3xl font-bold text-foreground",
  subtitle: "text-lg text-muted-foreground",
  backButton: "flex items-center gap-2 w-fit hover:bg-muted/50 transition-colors",

  // Split layout
  splitLayout: [
    'grid gap-6',
    'grid-cols-1 md:grid-cols-[280px_1fr]',
  ].join(' '),

  // Form panel (right side)
  formPanel: [
    'bg-card border border-border rounded-xl',
    'p-6',
    'min-h-[400px]',
  ].join(' '),

  // Empty state when no source selected
  emptyState: [
    'flex flex-col items-center justify-center',
    'py-16 text-center',
    'text-muted-foreground',
  ].join(' '),

  emptyStateIcon: 'text-5xl mb-4',
  emptyStateTitle: 'text-lg font-semibold text-foreground mb-2',
  emptyStateDesc: 'text-sm max-w-xs',

  // Legacy — kept for reference, can be removed
  contentSection: "space-y-8",
  sourceSelectorSection: "w-full",
  formSection: "w-full",
  cardsContainer: "transition-opacity duration-300",
  cardsDimmed: "opacity-70",
  cardsActive: "opacity-100",
} as const;
