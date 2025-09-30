export const createDocumentPageStyles = {
  container: "max-w-6xl mx-auto space-y-8 p-6",
  header: "space-y-4",
  headerContent: "space-y-2",
  title: "text-3xl font-bold text-foreground",
  subtitle: "text-lg text-muted-foreground",
  backButton: "flex items-center gap-2 w-fit hover:bg-muted/50 transition-colors",
  
  // New progressive disclosure layout
  contentSection: "space-y-8",
  sourceSelectorSection: "w-full",
  formSection: "w-full",
  
  // Card dimming effect when form is visible
  cardsContainer: "transition-opacity duration-300",
  cardsDimmed: "opacity-70",
  cardsActive: "opacity-100",
} as const;