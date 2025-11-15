/**
 * RuleFormSkeleton Component
 * 
 * Loading skeleton for rule form in RuleFormModal component
 */
export const RuleFormSkeleton = () => {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Title field skeleton */}
      <div className="space-y-2">
        <div className="h-4 bg-muted-foreground/20 rounded w-24" />
        <div className="h-10 bg-muted/50 rounded" />
      </div>

      {/* Color picker skeleton */}
      <div className="space-y-2">
        <div className="h-4 bg-muted-foreground/20 rounded w-20" />
        <div className="flex gap-2">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="w-8 h-8 rounded-full bg-muted-foreground/20" />
          ))}
        </div>
      </div>

      {/* Tags skeleton */}
      <div className="space-y-2">
        <div className="h-4 bg-muted-foreground/20 rounded w-16" />
        <div className="h-10 bg-muted/50 rounded" />
      </div>

      {/* Applicability skeleton */}
      <div className="space-y-3">
        <div className="h-4 bg-muted-foreground/20 rounded w-32" />
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-muted-foreground/20" />
              <div className="h-4 bg-muted-foreground/20 rounded w-24" />
            </div>
          ))}
        </div>
      </div>

      {/* Content editor skeleton */}
      <div className="space-y-2">
        <div className="h-4 bg-muted-foreground/20 rounded w-20" />
        <div className="h-48 bg-muted/50 rounded" />
        <div className="h-4 bg-muted-foreground/20 rounded w-32" />
      </div>

      {/* Default rule checkbox skeleton */}
      <div className="flex items-start gap-2 pt-4 border-t">
        <div className="w-4 h-4 mt-0.5 rounded bg-muted-foreground/20" />
        <div className="flex-1">
          <div className="h-4 bg-muted-foreground/20 rounded w-48 mb-1" />
          <div className="h-3 bg-muted-foreground/20 rounded w-64" />
        </div>
      </div>

      {/* Actions skeleton */}
      <div className="flex justify-end gap-2 pt-4">
        <div className="h-9 bg-muted-foreground/20 rounded w-20" />
        <div className="h-9 bg-muted-foreground/20 rounded w-24" />
      </div>
    </div>
  );
};
