/**
 * RuleListSkeleton Component
 * 
 * Loading skeleton for rule lists in RuleSelector component
 */
export const RuleListSkeleton = ({ count = 3 }: { count?: number }) => {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="flex items-start gap-3 p-3 rounded-md bg-muted/50 animate-pulse"
        >
          {/* Checkbox skeleton */}
          <div className="w-4 h-4 mt-0.5 rounded bg-muted-foreground/20" />
          
          {/* Content skeleton */}
          <div className="flex-1 space-y-2">
            {/* Title */}
            <div className="h-4 bg-muted-foreground/20 rounded w-3/4" />
            
            {/* Tags */}
            <div className="flex gap-2">
              <div className="h-5 bg-muted-foreground/20 rounded w-16" />
              <div className="h-5 bg-muted-foreground/20 rounded w-20" />
            </div>
            
            {/* Applicability badges */}
            <div className="flex flex-wrap gap-1">
              <div className="h-5 bg-muted-foreground/20 rounded w-12" />
              <div className="h-5 bg-muted-foreground/20 rounded w-16" />
              <div className="h-5 bg-muted-foreground/20 rounded w-14" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
