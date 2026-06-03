'use client';

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cn } from '../utils';
import {
  type ITopAppBar,
  type ITopAppBarBrand,
  type ITopAppBarBrandContent,
  type ITopAppBarMenuButton,
} from './ITopAppBar';

export function TopAppBar({
  className,
  innerClassName,
  start,
  brand,
  end,
  hidden = false,
}: ITopAppBar) {
  if (hidden) {
    return null;
  }

  return (
    <header
      className={cn(
        'linear-glass z-[1100] flex h-12 w-full flex-shrink-0 items-center border-b border-border/30',
        className
      )}
    >
      <div
        className={cn(
          'flex w-full items-center justify-between px-4',
          innerClassName
        )}
      >
        <div className="flex items-center gap-2.5">
          {start}
          {brand}
        </div>
        {end ? <div className="flex items-center gap-2">{end}</div> : null}
      </div>
    </header>
  );
}

export function TopAppBarMenuButton({
  className,
  icon,
  ...props
}: ITopAppBarMenuButton) {
  return (
    <button
      type="button"
      className={cn(
        'flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground',
        className
      )}
      {...props}
    >
      {icon}
    </button>
  );
}

export function TopAppBarBrand({
  className,
  asChild = false,
  children,
}: ITopAppBarBrand) {
  const Comp = asChild ? Slot : 'div';

  return (
    <Comp
      className={cn(
        'linear-transition flex items-center gap-1.5 hover:opacity-80',
        className
      )}
    >
      {children ?? <TopAppBarBrandContent />}
    </Comp>
  );
}

export function TopAppBarBrandContent({
  mascotSrc = '/mascot/forge-happy.svg',
  title = 'StudyForge',
}: ITopAppBarBrandContent) {
  return (
    <>
      <img src={mascotSrc} alt="" className="h-6 w-6 flex-shrink-0" />
      <span className="app-title-responsive text-sm font-semibold tracking-tight text-foreground">
        {title}
      </span>
    </>
  );
}
