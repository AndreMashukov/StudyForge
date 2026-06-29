import type { ReactNode } from 'react';

export interface IScreenHeader {
  title: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  className?: string;
}
