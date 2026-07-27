import { useEffect, useState } from 'react';

export interface IGridColumnBreakpoints {
  default: number;
  sm?: number;
  md?: number;
  lg?: number;
}

/**
 * Returns the current responsive column count for virtualized grids.
 */
export function useGridColumns(breakpoints: IGridColumnBreakpoints): number {
  const [columns, setColumns] = useState(breakpoints.default);

  useEffect(() => {
    const updateColumns = () => {
      const width = window.innerWidth;
      if (breakpoints.lg !== undefined && width >= 1024) {
        setColumns(breakpoints.lg);
        return;
      }
      if (breakpoints.md !== undefined && width >= 768) {
        setColumns(breakpoints.md);
        return;
      }
      if (breakpoints.sm !== undefined && width >= 640) {
        setColumns(breakpoints.sm);
        return;
      }
      setColumns(breakpoints.default);
    };

    updateColumns();
    window.addEventListener('resize', updateColumns);
    return () => window.removeEventListener('resize', updateColumns);
  }, [breakpoints.default, breakpoints.sm, breakpoints.md, breakpoints.lg]);

  return columns;
}
