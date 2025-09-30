export const sourceCardStyles = {
  container: [
    "group relative cursor-pointer",
    "border border-border rounded-xl p-6",
    "bg-card hover:bg-card/80",
    "transition-all duration-300 ease-in-out",
    "hover:border-primary/50 hover:shadow-lg hover:-translate-y-1",
    "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
    "min-h-[200px] flex flex-col"
  ].join(" "),
  
  selected: [
    "border-primary bg-primary/5",
    "shadow-lg shadow-primary/20",
    "-translate-y-1",
    "before:content-[''] before:absolute before:inset-0",
    "before:border-2 before:border-primary before:rounded-xl",
    "before:animate-pulse"
  ].join(" "),
  
  disabled: [
    "cursor-not-allowed opacity-60",
    "hover:border-border hover:shadow-none hover:translate-y-0",
    "hover:bg-card"
  ].join(" "),
  
  icon: "text-4xl mb-4 text-center",
  
  content: "flex-1 space-y-3",
  
  title: "text-lg font-semibold text-foreground group-hover:text-primary transition-colors",
  
  description: "text-sm text-muted-foreground leading-relaxed",
  
  footer: "mt-auto pt-4",
  
  button: "w-full transition-all duration-200",
  
  comingSoon: "text-xs text-muted-foreground font-medium text-center block w-full",
} as const;