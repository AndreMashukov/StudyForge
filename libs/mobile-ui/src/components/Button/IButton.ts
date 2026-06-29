export interface IButton {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'destructive' | 'ghost';
  size?: 'default' | 'sm' | 'lg';
  className?: string;
}
