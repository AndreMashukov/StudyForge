import { TextInput } from 'react-native';
import { cn } from '../../../lib/utils/cn';
import type { ITextInputField } from './ITextInputField';

export function TextInputField({
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  autoCapitalize,
  keyboardType,
  multiline,
  numberOfLines,
  className,
}: ITextInputField) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor="#71717a"
      secureTextEntry={secureTextEntry}
      autoCapitalize={autoCapitalize}
      keyboardType={keyboardType}
      multiline={multiline}
      numberOfLines={numberOfLines}
      textAlignVertical={multiline ? 'top' : 'center'}
      className={cn(
        'bg-input border border-border rounded-xl px-3.5 py-3 text-foreground text-base mb-2',
        multiline && 'min-h-[160px]',
        className
      )}
    />
  );
}
