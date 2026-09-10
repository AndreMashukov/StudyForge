import React from 'react';
import { cn } from '../../lib/utils';
import {
  CLUSTER_CELLS,
  CLUSTER_CELL_RADIUS,
  CLUSTER_CELL_SIZE,
} from '../brand/clusterMark';
import { IBrandMark } from './IBrandMark';

export const BrandMark = ({
  className,
  title = 'StudyForge',
  decorative = false,
}: IBrandMark): React.JSX.Element => {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      role={decorative ? 'presentation' : 'img'}
      aria-hidden={decorative ? true : undefined}
      aria-label={decorative ? undefined : title}
      className={cn('shrink-0', className)}
    >
      {decorative ? null : <title>{title}</title>}
      {CLUSTER_CELLS.map((cell) => (
        <rect
          key={`${cell.x}-${cell.y}`}
          x={cell.x}
          y={cell.y}
          width={CLUSTER_CELL_SIZE}
          height={CLUSTER_CELL_SIZE}
          rx={CLUSTER_CELL_RADIUS}
          fill={cell.fill}
        />
      ))}
    </svg>
  );
};
