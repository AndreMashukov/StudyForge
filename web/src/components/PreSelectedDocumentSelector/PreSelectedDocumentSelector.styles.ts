export const preSelectedDocumentSelectorStyles = {
  // Selected document card
  card: 'flex items-center gap-3 p-3 border bg-card border-border rounded-sm',
  cardIcon: 'flex-shrink-0 text-muted-foreground',
  cardInfo: 'flex-1 min-w-0',
  cardTitle: 'text-sm font-semibold truncate',
  cardMeta: 'text-xs text-muted-foreground mt-0.5',
  cardBadge: 'inline-flex items-center gap-1 text-xs font-medium text-primary bg-primary/10 rounded-full px-2 py-0.5 mt-1 w-fit',
  // Remove (×) button
  removeBtn: 'flex-shrink-0 ml-auto h-7 w-7 text-muted-foreground hover:text-destructive',
  // Add more button
  addMoreBtn: 'w-full border-dashed mt-1 gap-1.5 text-muted-foreground hover:text-foreground',
  // Helper text
  helperText: 'text-xs text-muted-foreground mt-1.5',
  // Picker panel
  pickerPanel: 'mt-2 rounded-md border border-border bg-card shadow-sm overflow-hidden',
  pickerLabel: 'text-xs font-medium text-muted-foreground px-3 pt-3 pb-1',
  pickerDivider: 'border-t border-dashed border-border my-3',
  // Loading skeleton
  loadingCard: 'flex items-center gap-3 p-3 border border-border rounded-sm animate-pulse',
  loadingIcon: 'h-5 w-5 flex-shrink-0 rounded bg-muted',
  loadingText: 'h-4 w-40 rounded bg-muted',
};
