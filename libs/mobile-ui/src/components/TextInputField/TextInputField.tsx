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
        'text-foreground text-sm font-sans mb-2',
        multiline
          ? 'min-h-[130px] border border-outline px-3.5 py-4 leading-5'
          : 'h-[37px] border-b border-outline px-0 pb-0 pt-[3px]',
        !editable && 'opacity-60',
        className
      )}
    />
  );
}
