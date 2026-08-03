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
      <div className={cn('document-plotly document-plotly-error', className)}>
        <p>Failed to render Plotly graph.</p>
        <p className="document-plotly-error-detail">{parsed.error}</p>
        <pre>{code}</pre>
      </div>
    );
  }

  const { data, layout, config } = parsed.figure;
  const has3d = data.some((trace) => {
    if (!trace || typeof trace !== 'object' || Array.isArray(trace)) {
      return false;
    }
    const type =
      typeof (trace as Record<string, unknown>).type === 'string'
        ? ((trace as Record<string, unknown>).type as string)
        : '';
    return type.includes('3d') || type === 'surface' || type === 'mesh3d';
  });

  return (
    <div className={cn('document-plotly', className)}>
      <div className="document-plotly-toolbar">
        <span className="document-plotly-toolbar-label">
          {has3d ? '3D Graph' : 'Graph'}
        </span>
      </div>
      <div className="document-plotly-stage">
        <Suspense
          fallback={
            <div className="document-plotly-loading">Loading graph...</div>
          }
        >
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
    </div>
  );
}
