declare module 'plotly.js-dist-min' {
  import type Plotly from 'plotly.js';
  const PlotlyDist: typeof Plotly;
  export default PlotlyDist;
}

declare module 'react-plotly.js/factory' {
  import type { ComponentType } from 'react';
  import type { PlotParams } from 'react-plotly.js';

  export default function createPlotlyComponent(
    plotly: unknown
  ): ComponentType<PlotParams>;
}
