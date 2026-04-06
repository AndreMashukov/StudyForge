export const sourceListPanelStyles = {
  container: [
    'w-[280px] shrink-0',
    'bg-card border border-border rounded-xl',
    'p-5 flex flex-col',
  ].join(' '),

  header: 'text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3',

  sourceItem: [
    'flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer',
    'transition-all duration-150',
    'text-muted-foreground',
    'mb-1',
  ].join(' '),

  sourceItemActive: [
    'bg-primary/10 text-primary',
    'border-l-[3px] border-l-primary',
  ].join(' '),

  sourceItemDisabled: 'opacity-40 cursor-not-allowed pointer-events-none',

  sourceIcon: [
    'w-10 h-10 rounded-[10px] flex items-center justify-center',
    'text-lg bg-muted shrink-0',
  ].join(' '),

  sourceIconActive: 'bg-primary/15',

  sourceInfo: 'flex-1 min-w-0',
  sourceName: 'text-[13px] font-medium leading-tight',
  sourceDesc: 'text-[11px] text-muted-foreground leading-tight mt-0.5',

  soonBadge: [
    'text-[10px] bg-muted px-2 py-0.5 rounded-full',
    'text-muted-foreground',
  ].join(' '),

  tipsSection: [
    'mt-6 pt-4 border-t border-border',
  ].join(' '),

  tipsTitle: 'text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3',

  tipsContent: 'text-xs text-muted-foreground leading-relaxed space-y-2',
} as const;
