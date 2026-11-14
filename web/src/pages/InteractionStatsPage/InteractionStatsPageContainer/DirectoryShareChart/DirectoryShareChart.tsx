import { useState } from 'react';
import { Button } from '../../../../components/ui/Button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../../../components/ui/Tooltip';
import type { IPieChartDatum } from '../../types/IInteractionStatsPage';
import { CHART_COLORS } from '../../utils/interactionStatsUtils';
import { directorySharePercentages } from './directorySharePercentages';

interface IDirectoryShareChart {
  data: IPieChartDatum[];
}

export const DirectoryShareChart = ({ data }: IDirectoryShareChart) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const rows = directorySharePercentages(data);
  const selected = rows.find((row) => row.directoryId === selectedId);
  let end = 0;
  const gradient = rows
    .map((row, index) => {
      const start = end;
      end += row.percentage;
      return `${CHART_COLORS[index % CHART_COLORS.length]} ${start}% ${end}%`;
    })
    .join(', ');

  if (!rows.length)
    return (
      <p className="flex min-h-56 items-center justify-center text-sm text-muted-foreground">
        No recorded activity in this range.
      </p>
    );

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex min-h-64 flex-col items-center justify-center gap-7 py-4 sm:flex-row">
        <div
          className="relative flex h-44 w-44 shrink-0 items-center justify-center rounded-full"
          style={{ background: `conic-gradient(${gradient})` }}
          role="img"
          aria-label={`Directory share of recorded activity: ${rows.map((row) => `${row.name} ${row.percentageLabel}`).join(', ')}`}
        >
          <div className="absolute inset-6 rounded-full bg-card" />
          <div className="relative max-w-28 text-center text-xs leading-relaxed text-muted-foreground">
            {selected ? (
              <>
                <strong className="block text-2xl font-semibold text-foreground">
                  {selected.percentageLabel}
                </strong>
                {selected.name}
              </>
            ) : (
              <>
                Relative
                <br />
                activity share
              </>
            )}
          </div>
        </div>
        <div className="w-full min-w-0 flex-1 space-y-1.5">
          {rows.map((row, index) => (
            <Tooltip key={row.directoryId}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  className="h-auto w-full justify-start gap-2 whitespace-normal px-1 py-1.5 text-left text-xs font-normal"
                  aria-label={`${row.name}: ${row.percentageLabel} of recorded activity`}
                  aria-pressed={row.directoryId === selectedId}
                  onClick={() => setSelectedId(row.directoryId)}
                >
                  <span
                    className="h-2 w-2 shrink-0"
                    style={{
                      backgroundColor:
                        CHART_COLORS[index % CHART_COLORS.length],
                    }}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1">{row.name}</span>
                  <span className="shrink-0 font-medium">
                    {row.percentageLabel}
                  </span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {row.name} · {row.percentageLabel} of recorded activity
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </div>
      <p className="text-xs text-muted-foreground" role="status">
        {selected
          ? `${selected.name} · ${selected.percentageLabel} of recorded activity.`
          : 'Choose a directory to inspect its relative share.'}
      </p>
    </TooltipProvider>
  );
};
