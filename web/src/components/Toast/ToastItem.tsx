import { useEffect } from "react";
import { X, CheckCircle, XCircle, Info, AlertTriangle } from "lucide-react";
import { IToastItem, ToastVariant } from "./IToast";
import { cn } from "../../lib/utils";

const variantStyles: Record<ToastVariant, { bg: string; border: string; icon: JSX.Element }> = {
  success: {
    bg: "bg-green-500/10 border-green-500",
    border: "border-green-500",
    icon: <CheckCircle className="text-green-500" size={20} />,
  },
  error: {
    bg: "bg-red-500/10 border-red-500",
    border: "border-red-500",
    icon: <XCircle className="text-red-500" size={20} />,
  },
  warning: {
    bg: "bg-yellow-500/10 border-yellow-500",
    border: "border-yellow-500",
    icon: <AlertTriangle className="text-yellow-500" size={20} />,
  },
  info: {
    bg: "bg-blue-500/10 border-blue-500",
    border: "border-blue-500",
    icon: <Info className="text-blue-500" size={20} />,
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
