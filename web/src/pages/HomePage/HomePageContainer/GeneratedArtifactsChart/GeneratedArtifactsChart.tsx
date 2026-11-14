import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Layers } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../../../../components/ui/Card';
import { Button } from '../../../../components/ui/Button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
} from '../../../../components/ui/Dialog';
import { useAppSelector } from '../../../../hooks/redux';
import { useHomePageContext } from '../../context/HomePageContext';
import {
  artifactPath,
  DASHBOARD_TYPE_LABELS,
  generationBuckets,
} from '../../utils/dashboardUtils';
import { formatDateWithOptions } from '../../../../utils/dateUtils';
import { DashboardPanelState } from '../DashboardPanelState';

export const GeneratedArtifactsChart = () => {
  const {
    api: { generations, range },
    handlers,
  } = useHomePageContext();
  const grouping = useAppSelector((state) => state.homePage.generationGrouping);
  const selectedTriggerRef = useRef<HTMLButtonElement | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const buckets = useMemo(
    () =>
      generationBuckets(
        generations.currentData?.artifacts ?? [],
        range,
        grouping,
      ),
    [generations.currentData, range, grouping],
  );
  const total = buckets.reduce(
    (sum, bucket) => sum + bucket.artifacts.length,
    0,
  );
  const max = Math.max(1, ...buckets.map((bucket) => bucket.artifacts.length));
  const selected = buckets.find((bucket) => bucket.id === selectedId);
  const loading = !generations.currentData && !generations.error;

  return (
    <Card aria-busy={generations.isFetching}>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Layers
              className="h-4 w-4 text-muted-foreground"
              aria-hidden="true"
            />
            Artifacts generated
          </CardTitle>
          <div
            className="flex gap-1 rounded-lg bg-muted p-1"
            role="group"
            aria-label="Generation chart grouping"
          >
            {(['date', 'type'] as const).map((mode) => (
              <Button
                key={mode}
                variant={mode === grouping ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 px-2 text-xs"
                aria-pressed={mode === grouping}
                onClick={() => {
                  setSelectedId(null);
                  handlers.handleGenerationGroupingChange(mode);
                }}
              >
                By {mode}
              </Button>
            ))}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Completed artifacts by{' '}
          {grouping === 'date' ? 'completion date' : 'type'}.
        </p>
      </CardHeader>
      <CardContent>
        {generations.error ? (
          <DashboardPanelState
            error
            message="Could not load generated artifacts."
            onRetry={() => generations.refetch()}
          />
        ) : loading ? (
          <DashboardPanelState loading message="Loading generated artifacts…" />
        ) : !total ? (
          <DashboardPanelState message="No completed artifacts recorded in this range." />
        ) : (
          <>
            <div
              className="flex h-64 items-end gap-2 pt-8 sm:gap-3"
              aria-label="Completed artifact counts"
            >
              {buckets.map((bucket) => (
                <Button
                  variant="ghost"
                  key={bucket.id}
                  className="flex h-full min-w-0 flex-1 flex-col justify-end rounded-none px-0 py-0 font-normal"
                  aria-label={`${bucket.label}: ${bucket.artifacts.length} completed artifacts`}
                  onClick={(event) => {
                    selectedTriggerRef.current = event.currentTarget;
                    setSelectedId(bucket.id);
                  }}
                >
                  <span
                    className="relative block w-full max-w-9 shrink-0 rounded-t bg-primary/70"
                    style={{
                      height: bucket.artifacts.length
                        ? `${(bucket.artifacts.length / max) * 155}px`
                        : '1px',
                      opacity: bucket.artifacts.length ? 1 : 0.7,
                    }}
                  >
                    <span className="absolute -top-6 inset-x-0 text-center text-xs text-foreground">
                      {bucket.artifacts.length}
                    </span>
                  </span>
                  <span className="mt-1 min-h-12 w-full whitespace-normal border-t border-border/60 pt-2 text-center text-[10px] leading-relaxed text-muted-foreground">
                    {bucket.label}
                  </span>
                </Button>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              {total} completed artifacts in this range
              {grouping === 'date' && range.dayCount === 30
                ? ' · 5-day groups'
                : ''}
              .
            </p>
          </>
        )}
        <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
          Counts cover artifacts currently in your library with known completion
          dates. Pending, failed, and document records are excluded.
        </p>
      </CardContent>
      <Dialog
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
      >
        <DialogContent
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            selectedTriggerRef.current?.focus();
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {selected?.label ?? 'Generated artifacts'}
            </DialogTitle>
            <DialogDescription>
              {selected?.artifacts.length ?? 0} completed artifacts in this
              group.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <ul className="divide-y divide-border/60">
              {selected?.artifacts.map((artifact) => (
                <li
                  key={`${artifact.artifactType}:${artifact.id}`}
                  className="py-3"
                >
                  <Link
                    to={artifactPath(artifact)}
                    onClick={() => setSelectedId(null)}
                    className="text-sm font-medium hover:text-primary focus-visible:outline-primary"
                  >
                    {artifact.title}
                  </Link>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {DASHBOARD_TYPE_LABELS[artifact.artifactType]} ·{' '}
                    {formatDateWithOptions(
                      artifact.completedAt.slice(0, 10),
                      'MMM d, yyyy',
                    )}
                  </p>
                </li>
              ))}
            </ul>
          </DialogBody>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
