import React from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { IPieChartDatum } from '../../types/IInteractionStatsPage';
import { CHART_COLORS, formatDuration } from '../../utils/interactionStatsUtils';
import { useChartTheme } from '../useChartTheme';

interface IDirectoryShareChart {
  data: IPieChartDatum[];
}

export const DirectoryShareChart: React.FC<IDirectoryShareChart> = ({
  data,
}) => {
  const theme = useChartTheme();
  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={2}
          dataKey="value"
          nameKey="name"
          strokeWidth={0}
        >
          {data.map((_, idx) => (
            <Cell
              key={idx}
              fill={CHART_COLORS[idx % CHART_COLORS.length]}
            />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: theme.tooltipBg,
            border: `1px solid ${theme.border}`,
            borderRadius: 8,
            color: theme.tooltipText,
          }}
          formatter={(value) => {
            const v = Number(value);
            const pct = total > 0 ? Math.round((v / total) * 100) : 0;
            return [`${formatDuration(v * 60)} (${pct}%)`, 'Time'];
          }}
        />
        <Legend
          layout="vertical"
          align="right"
          verticalAlign="middle"
          wrapperStyle={{ fontSize: 12, color: theme.text }}
          formatter={(value: string, entry) => {
            const payload = entry.payload as IPieChartDatum & { value: number };
            const pct =
              total > 0
                ? Math.round((payload.value / total) * 100)
                : 0;
            return `${value} (${pct}%)`;
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
};
