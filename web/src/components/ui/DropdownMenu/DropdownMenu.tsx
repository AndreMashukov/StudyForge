import * as React from "react";
import { cn } from "../../../lib/utils";

interface IDropdownMenu {
  children: React.ReactNode;
}

export const DropdownMenu = ({ children }: IDropdownMenu) => {
  const [open, setOpen] = React.useState(false);

  return (
    <div className="relative inline-block">
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child as React.ReactElement<any>, {
            open,
            setOpen,
          });
        }
        return child;
      })}
    </div>
  );
};

interface IDropdownMenuTrigger {
  children: React.ReactNode;
  open?: boolean;
  setOpen?: (open: boolean) => void;
  asChild?: boolean;
}

export const DropdownMenuTrigger = ({
  children,
  open,
  setOpen,
  asChild,
}: IDropdownMenuTrigger) => {
  const handleClick = () => {
    setOpen?.(!open);
  };

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<any>, {
      onClick: handleClick,
    });
  }

  return <button onClick={handleClick}>{children}</button>;
};

interface IDropdownMenuContent {
  children: React.ReactNode;
  open?: boolean;
  setOpen?: (open: boolean) => void;
  align?: "start" | "end";
  className?: string;
}

export const DropdownMenuContent = React.forwardRef<
  HTMLDivElement,
  IDropdownMenuContent
>(({ children, open, setOpen, align = "end", className }, ref) => {
  const contentRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        contentRef.current &&
        !contentRef.current.contains(event.target as Node)
      ) {
        setOpen?.(false);
      }
    };

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open, setOpen]);

  if (!open) return null;

  return (
    <div
      ref={contentRef}
      className={cn(
        "absolute z-50 mt-2 min-w-[180px] rounded-md border bg-popover p-1 text-popover-foreground shadow-md",
        align === "end" ? "right-0" : "left-0",
        className
      )}
    >
      {children}
    </div>
  );
});
DropdownMenuContent.displayName = "DropdownMenuContent";

interface IDropdownMenuItem {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
}

export const DropdownMenuItem = React.forwardRef<
  HTMLButtonElement,
  IDropdownMenuItem
>(({ children, onClick, className, disabled }, ref) => (
  <button
    ref={ref}
    onClick={onClick}
    disabled={disabled}
    className={cn(
      "relative flex w-full cursor-pointer items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors",
      "hover:bg-accent hover:text-accent-foreground",
      "focus:bg-accent focus:text-accent-foreground",
      "disabled:pointer-events-none disabled:opacity-50",
      className
    )}
  >
    {children}
  </button>
));
DropdownMenuItem.displayName = "DropdownMenuItem";

interface IDropdownMenuSeparator {
  className?: string;
}

export const DropdownMenuSeparator = React.forwardRef<
  HTMLDivElement,
  IDropdownMenuSeparator
>(({ className }, ref) => (
  <div
    ref={ref}
    className={cn("my-1 h-px bg-muted", className)}
  />
));
DropdownMenuSeparator.displayName = "DropdownMenuSeparator";
