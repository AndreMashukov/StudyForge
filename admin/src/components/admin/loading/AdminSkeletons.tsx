export interface ITableSkeletonProps {
  columns?: number;
  rows?: number;
}

export function AdminPageHeaderSkeleton() {
  return (
    <div className="space-y-2" aria-hidden>
      <div className="h-9 w-48 animate-pulse rounded-md bg-muted" />
      <div className="h-5 w-full max-w-xl animate-pulse rounded-md bg-muted" />
    </div>
  );
}

export function TableSkeleton({ columns = 4, rows = 5 }: ITableSkeletonProps) {
  return (
    <div
      className="overflow-hidden rounded-lg border border-border"
      aria-hidden
    >
      <div className="border-b border-border bg-muted/50 px-4 py-3">
        <div className="flex gap-8">
          {Array.from({ length: columns }, (_, index) => (
            <div
              key={`header-${index}`}
              className="h-4 w-20 animate-pulse rounded bg-muted"
            />
          ))}
        </div>
      </div>
      <div className="divide-y divide-border">
        {Array.from({ length: rows }, (_, rowIndex) => (
          <div key={`row-${rowIndex}`} className="flex gap-8 px-4 py-3">
            {Array.from({ length: columns }, (_, columnIndex) => (
              <div
                key={`cell-${rowIndex}-${columnIndex}`}
                className="h-4 max-w-[200px] flex-1 animate-pulse rounded bg-muted"
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function DashboardCardsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-3" aria-hidden>
      {Array.from({ length: 3 }, (_, index) => (
        <div
          key={`card-${index}`}
          className="rounded-lg border border-border bg-card p-6 shadow-sm"
        >
          <div className="mb-4 flex items-center justify-between">
            <div className="h-4 w-16 animate-pulse rounded bg-muted" />
            <div className="h-4 w-4 animate-pulse rounded bg-muted" />
          </div>
          <div className="h-8 w-12 animate-pulse rounded bg-muted" />
          <div className="mt-2 h-4 w-40 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}

export function ModelSettingsPanelSkeleton() {
  return (
    <div className="grid gap-6 xl:grid-cols-2" aria-hidden>
      {Array.from({ length: 2 }, (_, index) => (
        <div
          key={`panel-${index}`}
          className="space-y-4 rounded-lg border border-border bg-card p-6 shadow-sm"
        >
          <div className="h-6 w-32 animate-pulse rounded bg-muted" />
          <div className="h-4 w-full max-w-lg animate-pulse rounded bg-muted" />
          <div className="space-y-3">
            {Array.from({ length: 3 }, (_, fieldIndex) => (
              <div
                key={`field-${index}-${fieldIndex}`}
                className="h-10 animate-pulse rounded-md bg-muted"
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function UserDetailCardSkeleton() {
  return (
    <div
      className="space-y-4 rounded-lg border border-border bg-card p-6 shadow-sm"
      aria-hidden
    >
      <div className="h-7 w-56 animate-pulse rounded bg-muted" />
      <div className="space-y-3">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={`detail-${index}`}
            className="h-4 w-full max-w-md animate-pulse rounded bg-muted"
          />
        ))}
      </div>
    </div>
  );
}

export function AdminRouteLoadingSkeleton() {
  return (
    <div
      className="space-y-6"
      aria-busy="true"
      aria-label="Loading page"
    >
      <AdminPageHeaderSkeleton />
      <div className="h-64 animate-pulse rounded-lg border border-border bg-muted/30" />
    </div>
  );
}
