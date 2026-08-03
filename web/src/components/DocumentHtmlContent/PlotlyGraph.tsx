import { lazy, Suspense, useMemo } from 'react';
import type { Config, Data, Layout } from 'plotly.js';
import { parsePlotlySpec } from '../../lib/plotly-spec';
import { cn } from '../../lib/utils';

const Plot = lazy(async () => {
  const [{ default: createPlotlyComponent }, PlotlyModule] = await Promise.all([
    import('react-plotly.js/factory'),
    import('plotly.js-dist-min'),
  ]);
  const Plotly = 'default' in PlotlyModule ? PlotlyModule.default : PlotlyModule;
  return { default: createPlotlyComponent(Plotly) };
});

const DEFAULT_CONFIG: Partial<Config> = {
  displayModeBar: true,
  displaylogo: false,
  responsive: true,
  modeBarButtonsToRemove: ['sendDataToCloud', 'lasso2d', 'select2d'],
};

function mergePlotlyDarkLayout(layout?: Record<string, unknown>): Partial<Layout> {
  return {
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    font: { color: '#e5e7eb' },
    ...(layout as Partial<Layout> | undefined),
  };
}

export function PlotlyGraph({
  code,
  className,
}: {
  code: string;
  className?: string;
}) {
  const parsed = useMemo(() => parsePlotlySpec(code), [code]);

  if (!parsed.ok) {
    return (
      <div className={cn('document-plotly rounded-lg border border-destructive/40 p-4 my-4', className)}>
        <p className="text-destructive text-sm">Failed to render Plotly graph.</p>
        <p className="text-muted-foreground text-xs mt-1">{parsed.error}</p>
        <pre className="mt-2 overflow-x-auto text-xs">{code}</pre>
      </div>
    );
  }

  const { data, layout, config } = parsed.figure;
  const has3d = data.some((trace) => {
    if (!trace || typeof trace !== 'object' || Array.isArray(trace)) {
      return false;
    }
    const type = typeof (trace as Record<string, unknown>).type === 'string'
      ? ((trace as Record<string, unknown>).type as string)
      : '';
    return type.includes('3d') || type === 'surface' || type === 'mesh3d';
  });

  return (
    <div className={cn('document-plotly my-4', className)}>
      <Suspense fallback={<div className="text-sm text-muted-foreground py-6">Loading graph...</div>}>
        <Plot
          data={data as Data[]}
          layout={{
            ...mergePlotlyDarkLayout(layout),
            autosize: true,
            height: has3d ? 420 : 360,
          }}
          config={{ ...DEFAULT_CONFIG, ...(config as Partial<Config> | undefined) }}
          style={{ width: '100%', minHeight: has3d ? 420 : 360 }}
          useResizeHandler
        />
      </Suspense>
    </div>
  );
}
