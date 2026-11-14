import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { CalendarDays } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../../../../components/ui/Card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../../../components/ui/Tooltip';
import { useHomePageContext } from '../../context/HomePageContext';
import {
  buildActivityDays,
  DASHBOARD_TYPE_LABELS,
  shiftReportingDay,
} from '../../utils/dashboardUtils';
import { formatDateWithOptions } from '../../../../utils/dateUtils';
import { cn } from '../../../../lib/utils';
import { DashboardPanelState } from '../DashboardPanelState';
import { heatmapStyles } from './ActivityHeatmap.styles';

export const ActivityHeatmap = () => {
  const {
    api: { history, historyRange },
  } = useHomePageContext();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const date =
    selectedDate &&
    selectedDate >= historyRange.startDate &&
    selectedDate <= historyRange.endDate
      ? selectedDate
      : historyRange.endDate;
  const scrollRef = useRef<HTMLDivElement>(null);
  const buttonsRef = useRef(new Map<string, HTMLButtonElement>());
  const days = useMemo(
    () => buildActivityDays(history.currentData?.stats ?? [], historyRange),
    [history.currentData, historyRange],
  );
  const padding =
    (new Date(`${historyRange.startDate}T12:00:00Z`).getUTCDay() + 6) % 7;
  const weekCount = Math.ceil((padding + days.length) / 7);
  const months = days.flatMap((day, index) =>
    index === 0 || day.date.endsWith('-01')
      ? [{ date: day.date, column: Math.floor((index + padding) / 7) + 1 }]
      : [],
  );
  const selected = days.find((day) => day.date === date);
  const loading = !history.currentData && !history.error;

  useEffect(() => {
    if (!loading && scrollRef.current)
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
  }, [loading, historyRange.endDate]);

  const handleCellKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    current: string,
  ) => {
    const weekday = (new Date(`${current}T12:00:00Z`).getUTCDay() + 6) % 7;
    const offsets: Record<string, number> = {
      ArrowLeft: -7,
      ArrowRight: 7,
      ArrowUp: -1,
      ArrowDown: 1,
      Home: -weekday,
      End: 6 - weekday,
    };
    const offset = offsets[event.key];
    if (offset === undefined) return;
    event.preventDefault();
    const next = shiftReportingDay(current, offset);
    if (next < historyRange.startDate || next > historyRange.endDate) return;
    setSelectedDate(next);
    buttonsRef.current.get(next)?.focus({ preventScroll: true });
    buttonsRef.current
      .get(next)
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  };

  return (
    <Card aria-busy={history.isFetching}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarDays
              className="h-4 w-4 text-muted-foreground"
              aria-hidden="true"
            />
            Activity heatmap
          </CardTitle>
          <span className="shrink-0 text-xs text-muted-foreground">
            {formatDateWithOptions(historyRange.startDate, 'MM/dd')}–
            {formatDateWithOptions(historyRange.endDate, 'MM/dd')}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          The date filter above doesn’t apply to this chart.
        </p>
      </CardHeader>
      <CardContent>
        {history.error ? (
          <DashboardPanelState
            error
            message="Could not load activity history."
            onRetry={() => history.refetch()}
          />
        ) : loading ? (
          <DashboardPanelState loading message="Loading activity history…" />
        ) : (
          <TooltipProvider delayDuration={150}>
            <div
              ref={scrollRef}
              className={heatmapStyles.scroll}
              role="region"
              tabIndex={0}
              aria-label="Activity history. Scroll horizontally to explore all weeks."
            >
              <div className={heatmapStyles.canvas}>
                <div
                  className={heatmapStyles.months}
                  style={{
                    gridTemplateColumns: `repeat(${weekCount}, minmax(20px, 1fr))`,
                  }}
                  aria-hidden="true"
                >
                  {months.map((month, index) => (
                    <span
                      key={month.date}
                      style={{
                        gridColumn: `${month.column} / span ${(months[index + 1]?.column ?? weekCount + 1) - month.column}`,
                      }}
                    >
                      {formatDateWithOptions(month.date, 'MMM')}
                    </span>
                  ))}
                </div>
                <div className="flex gap-1">
                  <div className={heatmapStyles.weekdays} aria-hidden="true">
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(
                      (label) => (
                        <span key={label} className="flex items-center">
                          {label}
                        </span>
                      ),
                    )}
                  </div>
                  <div
                    className={heatmapStyles.grid}
                    aria-label="Daily recorded material variety"
                  >
                    {Array.from({ length: padding }, (_, index) => (
                      <span
                        key={`padding-${index}`}
                        className="h-5 w-5 md:h-7 md:w-7"
                        aria-hidden="true"
                      />
                    ))}
                    {days.map((day) => {
                      const count = day.materialTypes.length;
                      const level = day.hasActivity
                        ? Math.max(1, Math.min(4, count))
                        : 0;
                      const description = !day.hasActivity
                        ? 'No record'
                        : count
                          ? `${count} distinct material ${count === 1 ? 'type' : 'types'} recorded`
                          : 'Recorded activity; material types unavailable';
                      const label = `${formatDateWithOptions(day.date, 'MMM d, yyyy')}: ${description}`;
                      return (
                        <Tooltip key={day.date}>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              ref={(element) => {
                                if (element)
                                  buttonsRef.current.set(day.date, element);
                                else buttonsRef.current.delete(day.date);
                              }}
                              className={cn(
                                heatmapStyles.cell,
                                heatmapStyles.levels[level],
                                day.date === date && heatmapStyles.selected,
                              )}
                              data-activity-date={day.date}
                              aria-label={label}
                              aria-pressed={day.date === date}
                              tabIndex={day.date === date ? 0 : -1}
                              onClick={() => setSelectedDate(day.date)}
                              onKeyDown={(event) =>
                                handleCellKeyDown(event, day.date)
                              }
                            />
                          </TooltipTrigger>
                          <TooltipContent>{label}</TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
              <span>Distinct material types recorded per day</span>
              <div
                className="flex items-center gap-1"
                aria-label="Color scale: no record, one, two, three, four or more types"
              >
                <span className="mr-1">Less</span>
                {heatmapStyles.levels.map((level, index) => (
                  <span
                    key={level}
                    className={cn('h-3 w-3 rounded-[3px]', level)}
                    title={
                      index === 0
                        ? 'No record'
                        : index === 4
                          ? '4+ types'
                          : `${index} types`
                    }
                  />
                ))}
                <span className="ml-1">More</span>
              </div>
            </div>
            <p
              className="mt-4 border-t border-border/60 pt-3 text-xs leading-relaxed text-muted-foreground"
              role="status"
            >
              <span className="mr-3 font-medium text-foreground">
                {formatDateWithOptions(date, 'MMM d')}
              </span>
              {selected?.hasActivity
                ? selected.materialTypes.length
                  ? `${selected.materialTypes.length} material types recorded · ${selected.materialTypes.map((type) => DASHBOARD_TYPE_LABELS[type]).join(' · ')}`
                  : 'Activity recorded; material types unavailable.'
                : 'No activity record available for this date.'}
            </p>
          </TooltipProvider>
        )}
      </CardContent>
    </Card>
  );
};
