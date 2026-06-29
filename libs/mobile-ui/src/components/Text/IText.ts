import type { TextProps } from 'react-native';

export interface IText extends TextProps {
  variant?: 'body' | 'caption' | 'label';
  tone?: 'default' | 'muted' | 'primary' | 'destructive' | 'accent';
  className?: string;
}
