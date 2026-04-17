import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { IBarChartDatum } from '../../types/IInteractionStatsPage';
import { CHART_COLORS, formatDuration } from '../../utils/interactionStatsUtils';
import { useChartTheme } from '../useChartTheme';

interface ITimePerDirectoryChart {
  data: IBarChartDatum[];
}

export const TimePerDirectoryChart: React.FC<ITimePerDirectoryChart> = ({
  data,
}) => {
  const theme = useChartTheme();

  return (
    <div role="img" aria-label="Bar chart showing study time in minutes per directory" className="outline-none select-none">
    <ResponsiveContainer width="100%" height={300}>
      <BarChart
        data={data}
        margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
        layout="vertical"
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke={theme.grid}
          horizontal={false}
        />
        <XAxis
          type="number"
          tick={{ fill: theme.text, fontSize: 12 }}
          axisLine={{ stroke: theme.axis }}
          tickLine={false}
          unit=" min"
        />
        <YAxis
          type="category"
          dataKey="name"
          width={120}
          tick={{ fill: theme.text, fontSize: 12 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: theme.tooltipBg,
            border: `1px solid ${theme.border}`,
            borderRadius: 8,
            color: theme.tooltipText,
          }}
          formatter={(value) => [
            formatDuration(Number(value) * 60),
            'Time',
          ]}
          cursor={{ fill: theme.cursor }}
        />
        <Bar dataKey="minutes" radius={[0, 4, 4, 0]} maxBarSize={32}>
          {data.map((_, idx) => (
            <Cell
              key={idx}
              fill={CHART_COLORS[idx % CHART_COLORS.length]}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
    </div>
  );
};
