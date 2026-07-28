import * as React from 'react';
import * as Popover from '@radix-ui/react-popover';
import { cn } from '../../../lib/utils';

interface IDropdownMenu {
  children: React.ReactNode;
}

const DropdownMenuContext = React.createContext<{
  setOpen: (open: boolean) => void;
} | null>(null);

export const DropdownMenu = ({ children }: IDropdownMenu) => {
  const [open, setOpen] = React.useState(false);

  return (
    <DropdownMenuContext.Provider value={{ setOpen }}>
      <Popover.Root open={open} onOpenChange={setOpen}>
        {children}
      </Popover.Root>
    </DropdownMenuContext.Provider>
  );
};

interface IDropdownMenuTrigger {
  children: React.ReactNode;
  asChild?: boolean;
}

export const DropdownMenuTrigger = ({
  children,
  asChild,
}: IDropdownMenuTrigger) => {
  if (asChild && React.isValidElement(children)) {
    return <Popover.Trigger asChild>{children}</Popover.Trigger>;
  }

  return <Popover.Trigger asChild><button type="button">{children}</button></Popover.Trigger>;
};

interface IDropdownMenuContent {
  children: React.ReactNode;
  align?: 'start' | 'end' | 'center';
  className?: string;
  sideOffset?: number;
}

export const DropdownMenuContent = React.forwardRef<
  HTMLDivElement,
  IDropdownMenuContent
>(({ children, align = 'end', className, sideOffset = 8 }, ref) => (
  <Popover.Portal>
    <Popover.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      collisionPadding={10}
      className={cn(
        'z-50 min-w-[180px] rounded-md border bg-popover p-1 text-popover-foreground shadow-md outline-none',
        'data-[state=open]:animate-in data-[state=closed]:animate-out',
        'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
        'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
        'data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2',
        className,
      )}
      onOpenAutoFocus={(event) => event.preventDefault()}
      onCloseAutoFocus={(event) => event.preventDefault()}
    >
      {children}
    </Popover.Content>
  </Popover.Portal>
));
DropdownMenuContent.displayName = 'DropdownMenuContent';

interface IDropdownMenuItem {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
}

export const DropdownMenuItem = React.forwardRef<
  HTMLButtonElement,
  IDropdownMenuItem
>(({ children, onClick, className, disabled }, ref) => {
  const ctx = React.useContext(DropdownMenuContext);

  return (
    <button
      ref={ref}
      type="button"
      onClick={() => {
        if (disabled) return;
        onClick?.();
        ctx?.setOpen(false);
      }}
      disabled={disabled}
      className={cn(
        'relative flex w-full cursor-pointer items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors',
        'hover:bg-accent hover:text-accent-foreground',
        'focus-visible:bg-accent focus-visible:text-accent-foreground',
        'disabled:pointer-events-none disabled:opacity-50',
        className,
      )}
    >
      {children}
    </button>
  );
});
DropdownMenuItem.displayName = 'DropdownMenuItem';

interface IDropdownMenuSeparator {
  className?: string;
}

export const DropdownMenuSeparator = React.forwardRef<
  HTMLDivElement,
  IDropdownMenuSeparator
>(({ className }, ref) => (
  <div ref={ref} className={cn('my-1 h-px bg-muted', className)} />
));
DropdownMenuSeparator.displayName = 'DropdownMenuSeparator';
