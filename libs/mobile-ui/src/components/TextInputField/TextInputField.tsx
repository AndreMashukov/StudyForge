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
        'bg-input text-foreground text-base font-sans mb-2 px-4',
        multiline ? 'min-h-[130px] rounded-3xl py-3.5 leading-6' : 'h-12 rounded-full py-0',
        !editable && 'opacity-60',
        className
      )}
    />
  );
}
