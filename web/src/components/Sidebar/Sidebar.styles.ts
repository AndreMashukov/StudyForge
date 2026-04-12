import { cn } from "../../lib/utils";

export const sidebarStyles = {
  container: cn(
    "fixed top-12 left-0 h-[calc(100vh-48px)] overflow-x-hidden overflow-y-auto text-xs duration-300 scrollbar-hidden z-[1200]",
    "bg-card border-r border-border flex flex-col"
  ),
  expanded: "w-[220px]",
  collapsed: "w-[64px]",
  header: cn(
    "border-b border-border py-3 flex items-center h-10 flex-shrink-0",
    "bg-card"
  ),
  headerExpanded: "px-4 justify-between",
  headerCollapsed: "px-2 justify-center",
  toggleButton: cn(
    "flex h-6 w-6 cursor-pointer items-center justify-center rounded-md",
    "text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
  ),
  headerTitle: "text-sm font-semibold text-foreground truncate",
  section: "border-b border-border last:border-b-0 flex-shrink-0",
  sectionHeader: cn(
    "flex gap-2 px-3 justify-between py-3 items-center cursor-pointer",
    "hover:bg-muted/50 transition-colors"
  ),
  sectionIcon: cn(
    "w-[32px] h-[32px] flex items-center justify-center rounded-md flex-shrink-0",
    "text-muted-foreground transition-colors"
  ),
  sectionIconActive: "text-primary bg-primary/10",
  sectionTitle: "text-sm font-medium text-foreground truncate",
  collapseIcon: "text-muted-foreground hover:text-foreground transition-colors flex-shrink-0",
  sectionContent: "transition-all duration-300 ease-in-out overflow-hidden",
  sectionContentOpen: "max-h-[500px] opacity-100",
  sectionContentClosed: "max-h-0 opacity-0",
  itemsList: "space-y-0.5 px-2 pb-2",
  item: cn(
    "flex items-center gap-2.5 px-2.5 py-[7px] rounded-md cursor-pointer",
    "text-muted-foreground hover:text-foreground hover:bg-muted/50",
    "transition-colors text-[13px] font-medium"
  ),
  itemActive: "text-primary bg-primary/10",
  itemIcon: "w-4 h-4 flex-shrink-0",
  itemText: "truncate flex-1",
  // Section labels
  navSectionLabel: cn(
    "px-2.5 pt-4 pb-1 text-[11px] font-medium uppercase tracking-wider",
    "text-muted-foreground"
  ),
  // Collapsed state styles
  collapsedSectionHeader: "px-2 justify-center py-3",
  collapsedTooltip: cn(
    "absolute left-full ml-2 px-2 py-1 bg-popover text-popover-foreground",
    "text-xs rounded-md border border-border shadow-md z-50",
    "opacity-0 invisible group-hover:opacity-100 group-hover:visible",
    "transition-all duration-200 pointer-events-none whitespace-nowrap"
  ),
  // Footer — user profile
  sidebarFooter: cn(
    "border-t border-border mt-auto flex-shrink-0"
  ),
  sidebarFooterExpanded: "px-3 py-3 flex items-center gap-2.5",
  sidebarFooterCollapsed: "py-2 flex flex-col items-center gap-1.5",
  userAvatar: cn(
    "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
    "bg-primary/15 border border-primary/20 text-primary font-semibold text-xs"
  ),
  userInfo: "flex-1 min-w-0",
  userEmail: "text-xs font-medium text-foreground truncate block",
  userLabel: "text-[11px] text-muted-foreground block",
  signOutBtn: cn(
    "text-xs text-muted-foreground bg-transparent border-none cursor-pointer",
    "px-2 py-1 rounded-md transition-colors",
    "hover:text-foreground hover:bg-muted/50"
  ),
} as const;
