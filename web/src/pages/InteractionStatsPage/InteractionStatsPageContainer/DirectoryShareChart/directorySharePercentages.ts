import type { IPieChartDatum } from '../../types/IInteractionStatsPage';

interface IDirectorySharePercentage {
  directoryId: string;
  name: string;
  percentage: number;
  percentageLabel: string;
}

export function directorySharePercentages(
  data: IPieChartDatum[],
): IDirectorySharePercentage[] {
  const positive = data.filter(
    (row) => Number.isFinite(row.value) && row.value > 0,
  );
  const total = positive.reduce((sum, row) => sum + row.value, 0);
  if (!Number.isFinite(total) || total <= 0) return [];
  return positive.map((row) => {
    const percentage = (row.value / total) * 100;
    return {
      directoryId: row.directoryId,
      name: row.name,
      percentage,
      percentageLabel: percentage < 1 ? '<1%' : `${Math.round(percentage)}%`,
    };
  });
}
