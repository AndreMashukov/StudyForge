import { cn } from "../../lib/utils";

export const authFormStyles = {
  container: "w-full max-w-lg mx-auto",
  card: "linear-glass overflow-hidden rounded-[28px] border border-border/40 shadow-[0_24px_80px_rgba(0,0,0,0.35)]",
  
  // Header styles
  header: "text-center px-8 pt-8 pb-6",
  eyebrow: "mb-4 flex items-center justify-center gap-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-primary/80",
  eyebrowDot: "h-2 w-2 rounded-full bg-primary shadow-[0_0_18px_color-mix(in_srgb,var(--primary)_65%,transparent)]",
  title: "text-3xl font-semibold font-heading text-foreground",
  subtitle: "mt-3 text-sm leading-6 text-muted-foreground",
  
  // Content styles
  content: "px-8 pb-8",
  
  // Error styles
  errorContainer: "mb-6 rounded-2xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive",
  errorTitle: "font-medium",
  errorMessage: "text-destructive/80 mt-1",
  errorDetails: "mt-2",
  errorSummary: "text-xs cursor-pointer text-destructive/60",
  errorPre: "text-xs mt-2 p-2 bg-destructive/5 rounded overflow-auto",
  
  // Form styles
  form: "space-y-6",
  formFields: "space-y-5",
  fieldContainer: "",
  label: "text-sm text-foreground/90 font-medium",
  input: "mt-2 h-12 rounded-xl border-border/60 bg-input/80 px-4 focus:border-primary/60 focus:ring-2 focus:ring-primary/15 linear-transition",
  
  // Button styles
  submitButton: "h-12 w-full rounded-xl text-sm font-semibold linear-button linear-glow-hover",
  loadingSpinner: "w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2",
  
  // Success redirect styles
  successCard: "bg-card/95 rounded-[28px] border border-border/50 shadow-[0_24px_80px_rgba(0,0,0,0.35)]",
  successContent: "text-center p-8",
  successIcon: "mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent",
  successTitle: "text-xl font-semibold text-foreground mb-2",
  successSubtitle: "text-muted-foreground mb-4",
  successStatus: "inline-flex items-center px-3 py-2 bg-accent/10 rounded-lg text-sm text-accent-foreground",
  successIndicator: "w-2 h-2 bg-accent rounded-full mr-2 animate-pulse",
  
  // Support panel styles
  divider: "mt-6",
  dividerLine: "h-px bg-gradient-to-r from-transparent via-border/70 to-transparent",
  supportPanel: "mt-6 rounded-2xl border border-border/40 bg-background/35 p-4 text-left",
  supportLabel: "text-[11px] font-semibold uppercase tracking-[0.28em] text-primary/80",
  supportChips: "mt-3 flex flex-wrap gap-2",
  supportChip: "rounded-full border border-border/40 bg-muted/40 px-3 py-1 text-xs text-muted-foreground",
} as const;

// Helper function for conditional classes
export const getAuthFormClasses = (variant?: "default" | "loading" | "error") => {
  return cn(
    authFormStyles.container,
    variant === "loading" && "opacity-75 pointer-events-none",
    variant === "error" && "border-destructive/50"
  );
};