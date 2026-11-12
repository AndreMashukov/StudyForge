import { cn } from "../../lib/utils";

export const authFormStyles = {
  container: "w-full max-w-lg mx-auto",
  card: "overflow-hidden rounded-[28px] border border-border/60 bg-background shadow-[0_8px_30px_rgb(0_0_0/0.08)]",
  
  // Header styles
  header: "text-center px-8 pt-8 pb-6",
  eyebrow: "mb-4 flex items-center justify-center gap-2 text-xs font-medium text-muted-foreground",
  eyebrowDot: "h-2 w-2 rounded-full bg-primary",
  title: "text-3xl font-semibold tracking-tight text-foreground",
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
  input: "mt-2 h-12 px-5",
  
  // Button styles
  submitButton: "h-12 w-full text-sm font-semibold",
  
  // Success redirect styles
  successCard: "rounded-[28px] border border-border/60 bg-background shadow-[0_8px_30px_rgb(0_0_0/0.08)]",
  successContent: "text-center p-8",
  successTitle: "text-xl font-semibold text-foreground mb-2",
  successSubtitle: "text-muted-foreground mb-4",
  successStatus: "inline-flex items-center px-3 py-2 bg-muted rounded-full text-sm text-foreground",
  successIndicator: "w-2 h-2 bg-primary rounded-full mr-2 animate-pulse",
  
  // Support panel styles
  divider: "mt-6",
  dividerLine: "h-px bg-border/60",
  supportPanel: "mt-6 text-left",
  supportLabel: "text-xs font-medium text-muted-foreground",
  supportChips: "mt-3 flex flex-wrap gap-2",
  supportChip: "rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground",
} as const;

// Helper function for conditional classes
export const getAuthFormClasses = (variant?: "default" | "loading" | "error") => {
  return cn(
    authFormStyles.container,
    variant === "loading" && "opacity-75 pointer-events-none",
    variant === "error" && "border-destructive/50"
  );
};