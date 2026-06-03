import * as React from 'react';

export interface ISidebar {
  className?: string;
  header?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  overlay?: React.ReactNode;
  'aria-label'?: string;
}

export interface ISidebarNav {
  className?: string;
  children?: React.ReactNode;
  'aria-label'?: string;
}

export interface ISidebarSection {
  className?: string;
  label?: React.ReactNode;
  children?: React.ReactNode;
  isOpen?: boolean;
}

export interface ISidebarNavItem {
  className?: string;
  isActive?: boolean;
  icon?: React.ReactNode;
  label?: React.ReactNode;
  onClick?: () => void;
  onKeyDown?: React.KeyboardEventHandler<HTMLDivElement>;
  asChild?: boolean;
  children?: React.ReactNode;
}

export interface ISidebarProfileFooter {
  className?: string;
  avatarLabel: React.ReactNode;
  primaryText?: React.ReactNode;
  secondaryText?: React.ReactNode;
  action?: React.ReactNode;
  isOpen?: boolean;
}
