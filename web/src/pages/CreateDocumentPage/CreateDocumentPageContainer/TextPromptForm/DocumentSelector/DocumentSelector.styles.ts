/**
 * DocumentSelector Component Styles
 */

export const documentSelectorStyles = {
  container: 'py-4',
  scrollContainer: 'max-h-96 overflow-y-auto space-y-2 pr-2',
  
  // Loading state
  loadingContainer: 'flex flex-col items-center justify-center py-12 space-y-3',
  loadingSpinner: 'h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary',
  loadingText: 'text-sm text-muted-foreground',
  
  // Empty state
  emptyContainer: [
    'flex flex-col items-center justify-center py-12 space-y-3',
    'text-center',
  ].join(' '),
  emptyIcon: 'h-16 w-16 text-muted-foreground/50',
  emptyTitle: 'text-base font-medium text-foreground',
  emptyDescription: 'text-sm text-muted-foreground max-w-sm',
  emptyAction: 'mt-2',
  
  // Document item
  documentItem: [
    'flex items-start gap-3 p-3',
    'border border-border rounded-lg',
    'hover:bg-muted/50 hover:border-muted-foreground/20',
    'transition-colors duration-200',
    'cursor-pointer',
  ].join(' '),
  documentItemDisabled: [
    'opacity-50 cursor-not-allowed',
    'hover:bg-background hover:border-border',
  ].join(' '),
  documentItemSelected: 'bg-muted/30 border-primary/50',
  
  // Checkbox
  checkbox: [
    'h-4 w-4 mt-0.5',
    'rounded border-2 border-input',
    'text-primary',
    'focus:ring-2 focus:ring-ring focus:ring-offset-2',
    'cursor-pointer',
    'disabled:cursor-not-allowed disabled:opacity-50',
  ].join(' '),
  
  // Document content
  documentContent: 'flex-1 min-w-0',
  documentTitle: 'font-medium text-foreground text-sm line-clamp-2 break-words',
  documentMeta: 'flex items-center gap-3 mt-1.5 text-xs text-muted-foreground',
  documentMetaItem: 'flex items-center gap-1',
  documentMetaIcon: 'h-3.5 w-3.5',
  documentMetaDivider: 'h-3 w-px bg-border',
  
  // Warning badge
  warningBadge: [
    'inline-flex items-center gap-1',
    'px-2 py-0.5',
    'text-xs font-medium',
    'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    'border border-amber-500/20',
    'rounded-md',
  ].join(' '),
  warningIcon: 'h-3 w-3',
} as const;

