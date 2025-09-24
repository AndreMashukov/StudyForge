import { TextareaHTMLAttributes } from 'react';

export interface ITextarea extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  showCharCount?: boolean;
  maxLength?: number;
  helperText?: string;
}