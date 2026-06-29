import { TextInput } from 'react-native';
import { mobileUiColors } from '../../tokens/colors';
import { cn } from '../../lib/cn';
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
  editable = true,
  className,
}: ITextInputField) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={mobileUiColors.placeholder}
      secureTextEntry={secureTextEntry}
      autoCapitalize={autoCapitalize}
      keyboardType={keyboardType}
      multiline={multiline}
      numberOfLines={numberOfLines}
      editable={editable}
      textAlignVertical={multiline ? 'top' : 'center'}
      className={cn(
        'min-h-12 bg-input border border-border rounded-lg px-3.5 py-3 text-foreground text-base font-sans mb-2',
        multiline && 'min-h-[160px]',
        !editable && 'opacity-60',
        className
      )}
    />
  );
}
