import { useToast } from "./ToastContext";
import { ToastItem } from "./ToastItem";

/**
 * ToastContainer Component
 * 
 * Renders all active toast notifications in a fixed position
 */
export const ToastContainer = () => {
  const { toasts, removeToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-md w-full">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} {...toast} onClose={removeToast} />
      ))}
    </div>
  );
};
