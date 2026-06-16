export interface IButton {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'destructive';
  className?: string;
}
