import type { TextProps } from 'react-native';

export interface IHeading extends TextProps {
  level?: 1 | 2 | 3 | 4;
  className?: string;
}
