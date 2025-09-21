import { cn } from "../../lib/utils";

export const authFormStyles = {
  container: "max-w-md mx-auto",
  card: "linear-glass border border-border/30",
  
  // Header styles
  header: "text-center pt-8 pb-6",
  title: "text-xl font-semibold text-foreground mb-3",
  subtitle: "text-sm text-muted-foreground",
  
  // Content styles
  content: "px-8 pb-8",
  
  // Error styles
  errorContainer: "mb-6 p-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg text-sm",
  errorTitle: "font-medium",
  errorMessage: "text-destructive/80 mt-1",
  errorDetails: "mt-2",
  errorSummary: "text-xs cursor-pointer text-destructive/60",
  errorPre: "text-xs mt-2 p-2 bg-destructive/5 rounded overflow-auto",
  
  // Form styles
  form: "space-y-4",
  formFields: "space-y-4",
  fieldContainer: "",
  label: "text-sm text-foreground font-medium",
  input: "mt-1.5 bg-input border-border/50 focus:border-primary/50 linear-transition",
  
  // Button styles
  submitButton: "w-full mt-6 linear-button linear-glow-hover",
  loadingSpinner: "w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2",
  
  // Success redirect styles
  successCard: "bg-card border-border shadow-lg",
  successContent: "text-center p-8",
  successIcon: "mx-auto w-14 h-14 bg-accent rounded-xl flex items-center justify-center mb-4",
  successTitle: "text-xl font-semibold text-foreground mb-2",
  successSubtitle: "text-muted-foreground mb-4",
  successStatus: "inline-flex items-center px-3 py-2 bg-accent/10 rounded-lg text-sm text-accent-foreground",
  successIndicator: "w-2 h-2 bg-accent rounded-full mr-2 animate-pulse",
  
  // Divider styles
  divider: "mt-6 text-center",
  dividerLine: "relative",
  dividerLineInner: "absolute inset-0 flex items-center",
  dividerBorder: "w-full border-t border-border/30",
} as const;

// Helper function for conditional classes
export const getAuthFormClasses = (variant?: "default" | "loading" | "error") => {
  return cn(
    authFormStyles.container,
    variant === "loading" && "opacity-75 pointer-events-none",
    variant === "error" && "border-destructive/50"
  );
};