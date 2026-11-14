import { useMemo } from 'react';
import { CalendarDays, FolderOpen, Info, Layers, PieChart } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { DirectoryShareChart } from '../../InteractionStatsPage/InteractionStatsPageContainer/DirectoryShareChart';
import { useHomePageContext } from '../context/HomePageContext';
import {
  buildActivityDays,
  directoryShareData,
  generationBuckets,
} from '../utils/dashboardUtils';
import { useAppSelector } from '../../../hooks/redux';
import { ActivityHeatmap } from './ActivityHeatmap';
import { GeneratedArtifactsChart } from './GeneratedArtifactsChart';
import { DashboardPanelState } from './DashboardPanelState';

export const HomePageContainer = () => {
  const {
    api: { activity, directories, generations, range },
    handlers,
  } = useHomePageContext();
  const timeframe = useAppSelector((state) => state.homePage.timeframe);
  const days = useMemo(
    () => buildActivityDays(activity.currentData?.stats ?? [], range),
    [activity.currentData, range],
  );
  const shares = useMemo(
    () =>
      directoryShareData(
        activity.currentData?.stats ?? [],
        directories.currentData?.tree ?? [],
      ),
    [activity.currentData, directories.currentData],
  );
  const generatedCount = useMemo(
    () =>
      generationBuckets(
        generations.currentData?.artifacts ?? [],
        range,
        'date',
      ).reduce((sum, bucket) => sum + bucket.artifacts.length, 0),
    [generations.currentData, range],
  );
  const activityAvailable = Boolean(activity.currentData) && !activity.error;
  const shareAvailable =
    activityAvailable && Boolean(directories.currentData) && !directories.error;
  const generationAvailable =
    Boolean(generations.currentData) && !generations.error;
  const summary = [
    {
      title: 'Days with activity',
      value: activityAvailable
        ? `${days.filter((day) => day.hasActivity).length} / ${range.dayCount}`
        : '—',
      description: 'dates with a saved activity record',
      icon: CalendarDays,
    },
    {
      title: 'Active directories',
      value: shareAvailable ? shares.length : '—',
      description: 'top-level directories with study activity',
      icon: FolderOpen,
    },
    {
      title: 'Artifacts generated',
      value: generationAvailable ? generatedCount : '—',
      description: 'completed artifacts with known completion dates',
      icon: Layers,
    },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 pb-12 pt-6 md:px-0">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your recorded activity and what you generated.
          </p>
        </div>
        <div
          className="flex gap-1 rounded-lg bg-muted p-1"
          role="group"
          aria-label="Dashboard date filter"
        >
          {[
            { id: 'day', label: 'Today' },
            { id: 'week', label: '7 days' },
            { id: 'month', label: '30 days' },
          ].map((option) => (
            <Button
              key={option.id}
              variant={timeframe === option.id ? 'secondary' : 'ghost'}
              size="sm"
              className="h-8 px-3 text-xs"
              aria-pressed={timeframe === option.id}
              onClick={() => handlers.handleTimeframeChange(option.id)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </header>
      <section
        className="grid gap-3 sm:grid-cols-3"
        aria-label="Activity summary"
      >
        {summary.map((item) => (
          <Card key={item.title}>
            <CardContent className="p-4">
              <p className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                <item.icon className="h-3.5 w-3.5" aria-hidden="true" />
                {item.title}
              </p>
              <p className="mt-2 text-2xl font-semibold tracking-tight">
                {item.value}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                {item.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </section>
      <ActivityHeatmap />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card aria-busy={activity.isFetching || directories.isFetching}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <PieChart
                className="h-4 w-4 text-muted-foreground"
                aria-hidden="true"
              />
              Directory Share
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Relative share of recorded activity · top-level directories.
            </p>
          </CardHeader>
          <CardContent>
            {activity.error || directories.error ? (
              <DashboardPanelState
                error
                message="Could not load Directory Share."
                onRetry={() => {
                  activity.refetch();
                  directories.refetch();
                }}
              />
            ) : !shareAvailable ? (
              <DashboardPanelState loading message="Loading Directory Share…" />
            ) : (
              <DirectoryShareChart data={shares} />
            )}
            <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
              Proportions reflect tracker estimates. Percentages are shown
              throughout.
            </p>
          </CardContent>
        </Card>
        <GeneratedArtifactsChart />
      </div>
      <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>
          Generation and study activity are separate. Dates use UTC. Saved
          activity may appear after you leave a material.
        </span>
      </p>
    </div>
  );
};
