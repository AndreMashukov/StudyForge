import { cn } from "../../lib/utils";

export const markdownStyles = {
  // Main container
  container: "prose prose-invert max-w-none dark:prose-invert overflow-x-auto",
  
  // Typography
  heading: "scroll-mt-20 font-semibold text-foreground", // Increased scroll margin for sticky header
  h1: "text-3xl font-bold text-foreground mb-6 mt-8 first:mt-0 border-b border-border pb-3 scroll-mt-20",
  h2: "text-2xl font-semibold text-foreground mb-4 mt-6 border-b border-border/50 pb-2 scroll-mt-20",
  h3: "text-xl font-medium text-foreground mb-3 mt-5 scroll-mt-20",
  h4: "text-lg font-medium text-foreground mb-2 mt-4 scroll-mt-20",
  h5: "text-base font-medium text-foreground mb-2 mt-3 scroll-mt-20",
  h6: "text-sm font-medium text-foreground mb-1 mt-2 scroll-mt-20",
  
  // Text elements
  paragraph: "text-muted-foreground leading-7 mb-4",
  strong: "font-semibold text-foreground",
  em: "italic",
  
  // Lists
  ul: "list-disc list-inside space-y-1 mb-4 text-muted-foreground",
  ol: "list-decimal list-inside space-y-1 mb-4 text-muted-foreground",
  li: "text-muted-foreground",
  
  // Links
  a: "text-primary hover:text-primary/80 underline underline-offset-4 transition-colors",
  
  // Code
  inlineCode: "relative rounded bg-muted px-1.5 py-0.5 font-mono text-sm font-medium text-foreground",
  
  // Blockquote
  blockquote: "border-l-4 border-primary/30 pl-4 italic text-muted-foreground mb-4 bg-muted/30 py-2 rounded-r-md",
  
  // Tables
  table: "w-full border-collapse border border-border rounded-md overflow-hidden mb-4",
  th: "border border-border bg-muted px-4 py-2 text-left font-medium text-foreground",
  td: "border border-border px-4 py-2 text-muted-foreground",
  
  // Horizontal rule
  hr: "border-0 border-t border-border my-6",
  
  // Images
  img: "max-w-full h-auto rounded-md shadow-sm",
} as const;

export const getMarkdownClasses = (element: string, className?: string) => {
  return cn(markdownStyles[element as keyof typeof markdownStyles], className);
};