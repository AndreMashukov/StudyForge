import React from 'react';

export interface ICheckbox extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange'> {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  indeterminate?: boolean;
  error?: boolean;
  label?: React.ReactNode;
  description?: string;
}
