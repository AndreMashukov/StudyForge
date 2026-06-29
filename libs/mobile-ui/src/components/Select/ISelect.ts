export interface ISelectOption {
  label: string;
  value: string;
}

export interface ISelect {
  value: string | null;
  onValueChange: (value: string) => void;
  options: ISelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}
