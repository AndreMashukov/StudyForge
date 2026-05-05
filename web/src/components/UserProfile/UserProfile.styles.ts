export const userProfileStyles = {
  // Container styles
  container: "max-w-md mx-auto mt-8",
  
  // Card styles
  card: "border-border shadow-xl",
  
  // Header styles
  header: "",
  headerContent: "flex items-center justify-between",
  title: "text-xl text-foreground",
  avatar: "w-12 h-12 bg-gradient-to-br from-primary to-accent rounded-xl flex items-center justify-center shadow-lg",
  avatarText: "text-white font-bold text-lg",
  
  // Content styles
  content: "",
  infoSection: "space-y-4 mb-8",
  
  // Info item styles
  infoItem: "flex items-center p-3 bg-muted rounded-xl",
  infoIcon: "w-8 h-8 rounded-lg flex items-center justify-center mr-3",
  infoIconEmail: "w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center mr-3",
  infoIconUser: "w-8 h-8 bg-accent/10 rounded-lg flex items-center justify-center mr-3",
  infoIconVerified: "w-8 h-8 bg-success/10 rounded-lg flex items-center justify-center mr-3",
  infoIconUnverified: "w-8 h-8 bg-destructive/10 rounded-lg flex items-center justify-center mr-3",
  infoLabel: "text-sm font-medium text-muted-foreground",
  infoValue: "text-foreground font-semibold",
  infoValueMono: "text-foreground font-mono text-sm break-all",
  infoValueVerified: "font-semibold text-success",
  infoValueUnverified: "font-semibold text-destructive",
  
  // Error styles
  errorContainer: "mb-6 p-4 bg-destructive/10 border border-destructive/30 text-destructive rounded-xl flex items-center",
  errorIcon: "text-destructive mr-3 flex-shrink-0",
  errorTitle: "font-medium",
  errorMessage: "text-sm text-destructive",
  
  // Button styles
  signOutButton: "w-full bg-gradient-to-r from-destructive to-pink-600 hover:from-destructive/90 hover:to-pink-700 transform hover:scale-105 shadow-lg hover:shadow-xl transition-all duration-200",
  loadingContainer: "flex items-center justify-center",
  loadingIcon: "animate-spin -ml-1 mr-3 text-white",
  buttonContent: "flex items-center justify-center",
  buttonIcon: "mr-2",
} as const;

// Helper function for conditional icon classes
export const getInfoIconClasses = (verified?: boolean) => {
  if (verified === true) return userProfileStyles.infoIconVerified;
  if (verified === false) return userProfileStyles.infoIconUnverified;
  return userProfileStyles.infoIcon;
};

// Helper function for conditional value classes
export const getInfoValueClasses = (type: "default" | "mono" | "verified" | "unverified") => {
  switch (type) {
    case "mono":
      return userProfileStyles.infoValueMono;
    case "verified":
      return userProfileStyles.infoValueVerified;
    case "unverified":
      return userProfileStyles.infoValueUnverified;
    default:
      return userProfileStyles.infoValue;
  }
};