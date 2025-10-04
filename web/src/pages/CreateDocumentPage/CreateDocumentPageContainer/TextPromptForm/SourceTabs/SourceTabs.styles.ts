/**
 * SourceTabs Component Styles
 */

export const sourceTabsStyles = {
  container: 'border-b border-border',
  tabsList: 'flex gap-1',
  tab: [
    'flex items-center gap-2 px-4 py-2.5',
    'text-sm font-medium',
    'transition-all duration-200',
    'border-b-2 border-transparent',
    'hover:text-foreground hover:bg-muted/50',
    'disabled:opacity-50 disabled:cursor-not-allowed',
  ].join(' '),
  tabActive: [
    'text-primary',
    'border-b-2 border-primary',
    'bg-muted/30',
  ].join(' '),
  tabInactive: 'text-muted-foreground',
  icon: 'h-4 w-4',
  count: [
    'ml-1 px-1.5 py-0.5',
    'text-xs font-semibold',
    'rounded-full',
    'bg-muted',
  ].join(' '),
  countActive: 'bg-primary/10 text-primary',
} as const;

