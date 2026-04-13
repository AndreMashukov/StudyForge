import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
} from 'recharts';
import { IDailyTrendDatum } from '../../types/IInteractionStatsPage';
import { formatDuration } from '../../utils/interactionStatsUtils';
import { useChartTheme } from '../useChartTheme';

interface IDailyTrendChart {
  data: IDailyTrendDatum[];
}

export const DailyTrendChart: React.FC<IDailyTrendChart> = ({ data }) => {
  const theme = useChartTheme();

  return (
    <div role="img" aria-label="Line chart showing daily study time trend">
    <ResponsiveContainer width="100%" height={300}>
      <LineChart
        data={data}
        margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
      >
        <defs>
          <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={theme.primary} stopOpacity={0.3} />
            <stop offset="95%" stopColor={theme.primary} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke={theme.grid}
          vertical={false}
        />
        <XAxis
          dataKey="date"
          tick={{ fill: theme.text, fontSize: 11 }}
          axisLine={{ stroke: theme.axis }}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: theme.text, fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          unit=" min"
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
            'Study Time',
          ]}
          cursor={{ stroke: theme.axis, strokeDasharray: '4 4' }}
        />
        <Area
          type="monotone"
          dataKey="minutes"
          stroke="none"
          fill="url(#trendGradient)"
        />
        <Line
          type="monotone"
          dataKey="minutes"
          stroke={theme.primary}
          strokeWidth={2}
          dot={{ fill: theme.primary, r: 3, strokeWidth: 0 }}
          activeDot={{ fill: theme.primary, r: 5, strokeWidth: 2, stroke: theme.tooltipBg }}
        />
      </LineChart>
    </ResponsiveContainer>
    </div>
  );
};
