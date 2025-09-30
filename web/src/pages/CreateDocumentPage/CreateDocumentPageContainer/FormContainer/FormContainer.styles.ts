export const formContainerStyles = {
  container: [
    "w-full mt-8",
    "transition-all duration-300 ease-out",
    "transform-gpu", // Enable hardware acceleration
  ].join(" "),
  
  visible: [
    "opacity-100 translate-y-0",
    "animate-in slide-in-from-bottom-4",
  ].join(" "),
  
  hidden: [
    "opacity-0 translate-y-4",
    "animate-out slide-out-to-bottom-4",
  ].join(" "),
  
  content: [
    "bg-card border border-border rounded-xl",
    "shadow-lg shadow-black/5",
    "p-6",
    "relative overflow-hidden",
    // Subtle gradient border effect
    "before:content-[''] before:absolute before:inset-0",
    "before:rounded-xl before:p-[1px]",
    "before:bg-gradient-to-r before:from-primary/20 before:to-transparent",
    "before:-z-10",
  ].join(" "),
} as const;