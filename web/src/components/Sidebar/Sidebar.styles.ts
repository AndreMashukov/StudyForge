export const sidebarStyles = {
  container: 'overflow-hidden',
  scrollArea:
    'flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto scrollbar-hidden',
  section:
    '[&>div]:px-5 [&>div]:pb-2 [&>div]:pt-5 [&>div]:text-[10px] [&>div]:font-medium [&>div]:uppercase [&>div]:tracking-widest',
  navList: 'gap-0.5 space-y-0 px-2',
  navItem:
    'relative min-h-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
  navItemActive:
    '!bg-primary/10 !text-primary font-medium before:absolute before:-left-2 before:top-3 before:bottom-3 before:w-0.5 before:rounded-full before:bg-primary',
  utilityItem: 'min-h-9 text-xs',
  utilities: 'shrink-0 pb-1 pt-2',
  accountTrigger:
    'flex h-auto w-full justify-start gap-2.5 rounded-lg px-3 py-3 text-left font-normal hover:bg-foreground/[0.06]',
  accountTriggerCollapsed: 'justify-center px-2',
  accountTriggerActive: 'bg-primary/10 text-primary',
  accountMenu: 'z-[1300] w-56 border-border/60',
  tooltip: 'z-[1300]',
  mobileOverlay: 'z-[1199] bg-black/50',
  mobileContent:
    'fixed bottom-0 left-0 top-12 z-[1200] w-[280px] max-w-[85vw] outline-none',
  mobileSidebar: 'relative left-auto top-auto h-full w-full max-w-full',
} as const;
