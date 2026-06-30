import type { ReactNode } from 'react';
import type {
  Control,
  ControllerProps,
  FieldPath,
  FieldValues,
} from 'react-hook-form';

export interface IFormItem {
  children: ReactNode;
  className?: string;
}

export interface IFormLabel {
  children: ReactNode;
  className?: string;
}

export interface IFormControl {
  children: ReactNode;
}

export interface IFormMessage {
  className?: string;
}

export interface IFormDescription {
  children: ReactNode;
  className?: string;
}

export interface IFormRootError {
  className?: string;
}

export type IFormField<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> = ControllerProps<TFieldValues, TName>;

export interface IFormTextInput<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> {
  control: Control<TFieldValues>;
  name: TName;
  label: string;
  description?: string;
  placeholder?: string;
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
  multiline?: boolean;
  numberOfLines?: number;
  editable?: boolean;
  className?: string;
  itemClassName?: string;
}
