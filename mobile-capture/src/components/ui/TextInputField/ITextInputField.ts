export interface ITextInputField {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences';
  keyboardType?: 'default' | 'email-address';
  multiline?: boolean;
  numberOfLines?: number;
  className?: string;
}
