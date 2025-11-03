import * as React from "react";
import { cn } from "../../../lib/utils";
import { X } from "lucide-react";

interface IDialog {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

export const Dialog = ({ open, onOpenChange, children }: IDialog) => {
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        onOpenChange(false);
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50"
        onClick={() => onOpenChange(false)}
      />
      {/* Content */}
      <div className="relative z-50">{children}</div>
    </div>
  );
};

interface IDialogContent {
  children: React.ReactNode;
  className?: string;
}

export const DialogContent = React.forwardRef<HTMLDivElement, IDialogContent>(
  ({ children, className }, ref) => (
    <div
      ref={ref}
      className={cn(
        "bg-background border border-border rounded-lg shadow-lg",
        "max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto",
        className
      )}
    >
      {children}
    </div>
  )
);
DialogContent.displayName = "DialogContent";

interface IDialogHeader {
  children: React.ReactNode;
  className?: string;
  onClose?: () => void;
}

export const DialogHeader = React.forwardRef<HTMLDivElement, IDialogHeader>(
  ({ children, className, onClose }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex items-center justify-between p-6 border-b border-border",
        className
      )}
    >
      <div className="flex-1">{children}</div>
      {onClose && (
        <button
          onClick={onClose}
          className="ml-4 p-1 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Close dialog"
        >
          <X size={20} />
        </button>
      )}
    </div>
  )
);
DialogHeader.displayName = "DialogHeader";

interface IDialogTitle {
  children: React.ReactNode;
  className?: string;
}

export const DialogTitle = React.forwardRef<HTMLHeadingElement, IDialogTitle>(
  ({ children, className }, ref) => (
    <h2
      ref={ref}
      className={cn("text-xl font-semibold text-foreground", className)}
    >
      {children}
    </h2>
  )
);
DialogTitle.displayName = "DialogTitle";

interface IDialogDescription {
  children: React.ReactNode;
  className?: string;
}

export const DialogDescription = React.forwardRef<
  HTMLParagraphElement,
  IDialogDescription
>(({ children, className }, ref) => (
  <p ref={ref} className={cn("text-sm text-muted-foreground mt-1", className)}>
    {children}
  </p>
));
DialogDescription.displayName = "DialogDescription";

interface IDialogBody {
  children: React.ReactNode;
  className?: string;
}

export const DialogBody = React.forwardRef<HTMLDivElement, IDialogBody>(
  ({ children, className }, ref) => (
    <div ref={ref} className={cn("p-6", className)}>
      {children}
    </div>
  )
);
DialogBody.displayName = "DialogBody";

interface IDialogFooter {
  children: React.ReactNode;
  className?: string;
}

export const DialogFooter = React.forwardRef<HTMLDivElement, IDialogFooter>(
  ({ children, className }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex items-center justify-end gap-2 p-6 border-t border-border",
        className
      )}
    >
      {children}
    </div>
  )
);
DialogFooter.displayName = "DialogFooter";
