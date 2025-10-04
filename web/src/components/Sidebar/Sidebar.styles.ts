import { cn } from "../../lib/utils";

export const sidebarStyles = {
  container: cn(
    "fixed top-0 left-0 h-screen overflow-x-hidden overflow-y-auto text-xs duration-300 scrollbar-hidden z-[1200]",
    "bg-card border-r border-border flex flex-col"
  ),
  expanded: "w-[200px]",
  collapsed: "w-[64px]",
  header: cn(
    "border-b border-border py-3 flex items-center h-12 flex-shrink-0",
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
  itemsList: "space-y-1 px-2 pb-3",
  item: cn(
    "flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer",
    "text-muted-foreground hover:text-foreground hover:bg-muted/50",
    "transition-colors text-sm"
  ),
  itemActive: "text-primary bg-primary/10 font-medium",
  itemIcon: "w-4 h-4 flex-shrink-0",
  itemText: "truncate flex-1",
  // Collapsed state styles
  collapsedSectionHeader: "px-2 justify-center py-3",
  collapsedTooltip: cn(
    "absolute left-full ml-2 px-2 py-1 bg-popover text-popover-foreground",
    "text-xs rounded-md border border-border shadow-md z-50",
    "opacity-0 invisible group-hover:opacity-100 group-hover:visible",
    "transition-all duration-200 pointer-events-none whitespace-nowrap"
  ),
} as const;