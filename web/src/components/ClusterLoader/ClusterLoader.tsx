import React from 'react';
import { cn } from '../../lib/utils';
import {
  CLUSTER_CELLS,
  CLUSTER_CELL_RADIUS,
  CLUSTER_CELL_SIZE,
} from '../brand/clusterMark';
import { clusterLoaderStyles } from './ClusterLoader.styles';
import { IClusterLoader } from './IClusterLoader';

export const ClusterLoader = ({
  size = 'md',
  className,
  label = 'Loading',
  decorative = false,
}: IClusterLoader): React.JSX.Element => {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      role={decorative ? 'presentation' : 'status'}
      aria-hidden={decorative ? true : undefined}
      aria-label={decorative ? undefined : label}
      className={cn('shrink-0', clusterLoaderStyles.size[size], className)}
    >
      {CLUSTER_CELLS.map((cell, index) => (
        <rect
          key={`${cell.x}-${cell.y}`}
          className="sf-cluster-cell"
          x={cell.x}
          y={cell.y}
          width={CLUSTER_CELL_SIZE}
          height={CLUSTER_CELL_SIZE}
          rx={CLUSTER_CELL_RADIUS}
          fill={cell.fill}
          style={{ animationDelay: `${index * 140}ms` }}
        />
      ))}
    </svg>
  );
};
