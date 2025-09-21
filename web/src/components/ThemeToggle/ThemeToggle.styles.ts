import { cn } from "../../lib/utils";

export const themeToggleStyles = {
  // Container styles
  container: "relative",
  
  // Compact button styles
  compactButton: "flex items-center gap-2 transition-all duration-300",
  colorPreviewContainer: "flex gap-1",
  colorPreview: "w-3 h-3 rounded-full border",
  compactButtonText: "text-sm font-medium",
  expandIcon: "w-4 h-4 transition-transform duration-300",
  expandIconRotated: "w-4 h-4 transition-transform duration-300 rotate-180",
  
  // Expanded popover styles
  popover: "absolute top-0 left-0 z-50 p-4 rounded-lg border shadow-lg transition-all duration-300",
  popoverHeader: "flex items-center justify-between mb-4",
  popoverTitle: "text-lg font-semibold",
  closeButton: "p-1 rounded transition-colors",
  closeIcon: "w-5 h-5",
  
  // Theme grid styles
  themeGrid: "grid grid-cols-2 gap-3 min-w-[280px]",
  
  // Theme preview styles
  themePreview: "relative group flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all duration-300",
  themePreviewActive: "border-primary scale-105",
  themePreviewInactive: "border-border hover:border-muted-foreground",
  themePreviewHovered: "transform hover:scale-102",
  
  // Theme preview content
  themeColors: "flex gap-1 mb-1",
  themeColorDot: "w-4 h-4 rounded-full border",
  themeName: "text-sm font-medium transition-colors",
  
  // Active indicator
  activeIndicator: "absolute -top-1 -right-1 w-3 h-3 rounded-full border-2",
  
  // Hover glow effect
  hoverGlow: "absolute inset-0 rounded-lg opacity-20 transition-opacity",
  
  // Description
  description: "text-xs mt-3 text-center opacity-70",
  
  // Backdrop
  backdrop: "fixed inset-0 z-40 transition-opacity duration-300",
} as const;

// Helper functions for dynamic styling
export const getThemePreviewClasses = (isActive: boolean, isHovered: boolean) => {
  return cn(
    themeToggleStyles.themePreview,
    isActive ? themeToggleStyles.themePreviewActive : themeToggleStyles.themePreviewInactive,
    isHovered && themeToggleStyles.themePreviewHovered
  );
};

export const getExpandIconClasses = (isExpanded: boolean) => {
  return cn(
    isExpanded ? themeToggleStyles.expandIconRotated : themeToggleStyles.expandIcon
  );
};