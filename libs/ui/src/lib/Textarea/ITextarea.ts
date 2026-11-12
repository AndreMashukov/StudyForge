import type * as React from 'react';

export interface ITextarea
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  showCharCount?: boolean;
  maxLength?: number;
  helperText?: string;
}
