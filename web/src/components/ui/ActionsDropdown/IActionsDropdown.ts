import { ReactNode } from 'react';

export interface IActionsDropdownItem {
  id: string;
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
}

export interface IActionsDropdown {
  items: IActionsDropdownItem[];
  trigger?: ReactNode;
  align?: 'start' | 'end';
  disabled?: boolean;
  className?: string;
}