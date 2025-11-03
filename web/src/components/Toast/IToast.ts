import { ReactNode } from "react";

export type ToastVariant = "success" | "error" | "info" | "warning";

export interface IToast {
  id: string;
  message: string;
  variant?: ToastVariant;
  duration?: number;
}

export interface IToastContainer {
  children?: ReactNode;
}

export interface IToastItem extends IToast {
  onClose: (id: string) => void;
}
