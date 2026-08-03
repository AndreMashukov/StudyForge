interface PlotlyParseSuccess {
  ok: true;
  figure: {
    data: unknown[];
    layout?: Record<string, unknown>;
    config?: Record<string, unknown>;
  };
}

interface PlotlyParseFailure {
  ok: false;
  error: string;
}

export type PlotlyParseResult = PlotlyParseSuccess | PlotlyParseFailure;

export function parsePlotlySpec(code: string): PlotlyParseResult {
  try {
    const parsed = JSON.parse(code) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ok: false, error: 'Plotly spec must be a JSON object.' };
    }
    if (!Array.isArray(parsed.data) || parsed.data.length === 0) {
      return { ok: false, error: 'Plotly spec requires a non-empty data array.' };
    }
    return {
      ok: true,
      figure: {
        data: parsed.data,
        layout: typeof parsed.layout === 'object' && parsed.layout !== null
          ? (parsed.layout as Record<string, unknown>)
          : undefined,
        config: typeof parsed.config === 'object' && parsed.config !== null
          ? (parsed.config as Record<string, unknown>)
          : undefined,
      },
    };
  } catch {
    return { ok: false, error: 'Invalid Plotly JSON.' };
  }
}
