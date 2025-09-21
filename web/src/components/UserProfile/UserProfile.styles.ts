export const userProfileStyles = {
  // Container styles
  container: "max-w-md mx-auto mt-8",
  
  // Card styles
  card: "border-gray-100 shadow-xl",
  
  // Header styles
  header: "",
  headerContent: "flex items-center justify-between",
  title: "text-xl text-foreground",
  avatar: "w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg",
  avatarText: "text-white font-bold text-lg",
  
  // Content styles
  content: "",
  infoSection: "space-y-4 mb-8",
  
  // Info item styles
  infoItem: "flex items-center p-3 bg-muted rounded-xl",
  infoIcon: "w-8 h-8 rounded-lg flex items-center justify-center mr-3",
  infoIconEmail: "w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mr-3",
  infoIconUser: "w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center mr-3",
  infoIconVerified: "w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center mr-3",
  infoIconUnverified: "w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center mr-3",
  infoLabel: "text-sm font-medium text-muted-foreground",
  infoValue: "text-foreground font-semibold",
  infoValueMono: "text-foreground font-mono text-sm break-all",
  infoValueVerified: "font-semibold text-green-600",
  infoValueUnverified: "font-semibold text-red-600",
  
  // Error styles
  errorContainer: "mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center",
  errorIcon: "text-red-500 mr-3 flex-shrink-0",
  errorTitle: "font-medium",
  errorMessage: "text-sm text-red-600",
  
  // Button styles
  signOutButton: "w-full bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 transform hover:scale-105 shadow-lg hover:shadow-xl transition-all duration-200",
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