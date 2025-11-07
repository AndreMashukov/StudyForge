export interface IDialog {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

export interface IDialogContent {
  children: React.ReactNode;
  className?: string;
}

export interface IDialogHeader {
  children: React.ReactNode;
  className?: string;
}

export interface IDialogTitle {
  children: React.ReactNode;
  className?: string;
}

export interface IDialogDescription {
  children: React.ReactNode;
  className?: string;
}

export interface IDialogFooter {
  children: React.ReactNode;
  className?: string;
}
