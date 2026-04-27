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
  const filteredData = data.filter(
    (d) => total > 0 && Math.round((d.value / total) * 100) > 0
  );
  const filteredTotal = filteredData.reduce((sum, d) => sum + d.value, 0);

  return (
    <div role="img" aria-label="Pie chart showing the share of study time per directory">
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={filteredData}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={2}
          dataKey="value"
          nameKey="name"
          strokeWidth={0}
        >
          {filteredData.map((_, idx) => (
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
            const pct = filteredTotal > 0 ? Math.round((v / filteredTotal) * 100) : 0;
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
              filteredTotal > 0
                ? Math.round((payload.value / filteredTotal) * 100)
                : 0;
            return `${value} (${pct}%)`;
          }}
        />
      </PieChart>
    </ResponsiveContainer>
    </div>
  );
};
