import React, { useEffect } from "react";
import { X, CheckCircle, XCircle, Info, AlertTriangle } from "lucide-react";
import { IToastItem, ToastVariant } from "./IToast";
import { cn } from "../../lib/utils";

const variantStyles: Record<ToastVariant, { bg: string; border: string; icon: React.ReactElement }> = {
  success: {
    bg: "bg-success/10 border-success",
    border: "border-success",
    icon: <CheckCircle className="text-success" size={20} />,
  },
  error: {
    bg: "bg-destructive/10 border-destructive",
    border: "border-destructive",
    icon: <XCircle className="text-destructive" size={20} />,
  },
  warning: {
    bg: "bg-primary/10 border-primary",
    border: "border-primary",
    icon: <AlertTriangle className="text-primary" size={20} />,
  },
  info: {
    bg: "bg-accent/10 border-accent",
    border: "border-accent",
    icon: <Info className="text-accent" size={20} />,
  },
};

export const ToastItem = ({ id, message, variant = "info", duration = 5000, onClose }: IToastItem) => {
  const style = variantStyles[variant];

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        onClose(id);
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [id, duration, onClose]);

  return (
    <div
      className={cn(
        "flex items-start gap-3 p-4 rounded-lg border shadow-lg backdrop-blur-sm animate-in slide-in-from-right duration-300",
        style.bg,
        style.border
      )}
    >
      {style.icon}
      <p className="flex-1 text-sm font-medium text-foreground">{message}</p>
      <button
        onClick={() => onClose(id)}
        className="text-muted-foreground hover:text-foreground transition-colors"
      >
        <X size={18} />
      </button>
    </div>
  );
};
