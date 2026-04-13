import { useMemo } from 'react';

interface IChartTheme {
  primary: string;
  text: string;
  grid: string;
  axis: string;
  border: string;
  tooltipBg: string;
  tooltipText: string;
  cursor: string;
}

function getCssVar(name: string): string {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
}

export function useChartTheme(): IChartTheme {
  return useMemo(() => {
    const primary = getCssVar('--primary');
    const foreground = getCssVar('--foreground');
    const muted = getCssVar('--muted');
    const mutedFg = getCssVar('--muted-foreground');
    const card = getCssVar('--card');
    const border = getCssVar('--border');

    return {
      primary: primary ? `rgb(${primary})` : 'hsl(262, 83%, 66%)',
      text: mutedFg ? `rgb(${mutedFg})` : '#888',
      grid: border ? `rgb(${border})` : '#333',
      axis: border ? `rgb(${border})` : '#333',
      border: border ? `rgb(${border})` : '#333',
      tooltipBg: card ? `rgb(${card})` : '#1a1a1a',
      tooltipText: foreground ? `rgb(${foreground})` : '#fff',
      cursor: muted ? `rgb(${muted} / 0.3)` : 'rgba(255,255,255,0.05)',
    };
  }, []);
}
