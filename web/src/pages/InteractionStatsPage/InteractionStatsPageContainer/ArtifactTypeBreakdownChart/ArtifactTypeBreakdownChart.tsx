import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { ArtifactType } from '@shared-types';
import { IStackedBarDatum } from '../../types/IInteractionStatsPage';
import {
  ARTIFACT_TYPE_COLORS,
  getArtifactLabel,
  formatDuration,
} from '../../utils/interactionStatsUtils';
import { useChartTheme } from '../useChartTheme';

interface IArtifactTypeBreakdownChart {
  data: IStackedBarDatum[];
}

const STACKED_KEYS: ArtifactType[] = [
  'document',
  'quiz',
  'flashcardSet',
  'slideDeck',
  'diagramQuiz',
  'sequenceQuiz',
];

export const ArtifactTypeBreakdownChart: React.FC<
  IArtifactTypeBreakdownChart
> = ({ data }) => {
  const theme = useChartTheme();

  const activeKeys = STACKED_KEYS.filter((key) =>
    data.some((d) => d[key] > 0)
  );

  return (
    <div role="img" aria-label="Stacked bar chart showing study time broken down by artifact type per directory" className="outline-none select-none">
    <ResponsiveContainer width="100%" height={300}>
      <BarChart
        data={data}
        margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke={theme.grid}
          vertical={false}
        />
        <XAxis
          dataKey="name"
          tick={{ fill: theme.text, fontSize: 11 }}
          axisLine={{ stroke: theme.axis }}
          tickLine={false}
          interval={0}
          angle={data.length > 5 ? -30 : 0}
          textAnchor={data.length > 5 ? 'end' : 'middle'}
          height={data.length > 5 ? 60 : 30}
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
          formatter={(value, name) => [
            formatDuration(Number(value) * 60),
            getArtifactLabel(String(name) as ArtifactType),
          ]}
          cursor={{ fill: theme.cursor }}
        />
        <Legend
          formatter={(value: string) =>
            getArtifactLabel(value as ArtifactType)
          }
          wrapperStyle={{ fontSize: 12, color: theme.text }}
        />
        {activeKeys.map((key) => (
          <Bar
            key={key}
            dataKey={key}
            stackId="artifacts"
            fill={ARTIFACT_TYPE_COLORS[key]}
            radius={0}
            maxBarSize={40}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
    </div>
  );
};
