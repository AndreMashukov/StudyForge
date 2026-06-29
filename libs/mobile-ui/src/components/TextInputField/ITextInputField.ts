import type { TextInputProps } from 'react-native';

export interface ITextInputField extends Pick<
  TextInputProps,
  | 'value'
  | 'onChangeText'
  | 'placeholder'
  | 'secureTextEntry'
  | 'autoCapitalize'
  | 'keyboardType'
  | 'multiline'
  | 'numberOfLines'
  | 'editable'
> {
  className?: string;
}
