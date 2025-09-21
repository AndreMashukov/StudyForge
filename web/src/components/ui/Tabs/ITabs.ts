import React from 'react';

export interface ITabsProps {
  value: string;
  onValueChange: (value: string) => void;
  children: React.ReactNode;
  className?: string;
}

export interface ITabsListProps {
  children: React.ReactNode;
  className?: string;
}

export interface ITabsTriggerProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

export interface ITabsContentProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}