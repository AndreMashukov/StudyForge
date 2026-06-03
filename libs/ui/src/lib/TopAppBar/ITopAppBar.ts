import * as React from 'react';

export interface ITopAppBar {
  className?: string;
  innerClassName?: string;
  start?: React.ReactNode;
  brand?: React.ReactNode;
  end?: React.ReactNode;
  hidden?: boolean;
}

export interface ITopAppBarMenuButton
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
}

export interface ITopAppBarBrand {
  className?: string;
  asChild?: boolean;
  children?: React.ReactNode;
}

export interface ITopAppBarBrandContent {
  mascotSrc?: string;
  title?: React.ReactNode;
}
