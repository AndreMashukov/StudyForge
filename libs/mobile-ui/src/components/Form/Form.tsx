import { createContext, useContext, useId } from 'react';
import { View } from 'react-native';
import {
  Controller,
  FormProvider,
  useFormContext,
  type ControllerProps,
  type FieldPath,
  type FieldValues,
} from 'react-hook-form';
import { cn } from '../../lib/cn';
import { FieldError } from '../FieldError';
import { FieldLabel } from '../FieldLabel';
import { Text } from '../Text';
import type {
  IFormControl,
  IFormDescription,
  IFormItem,
  IFormLabel,
  IFormMessage,
  IFormRootError,
} from './IForm';

const Form = FormProvider;

type IFormFieldContextValue = {
  name: string;
};

const FormFieldContext = createContext<IFormFieldContextValue | null>(null);

type IFormItemContextValue = {
  id: string;
};

const FormItemContext = createContext<IFormItemContextValue | null>(null);

function useFormField() {
  const fieldContext = useContext(FormFieldContext);
  const itemContext = useContext(FormItemContext);
  const { getFieldState, formState } = useFormContext();

  if (!fieldContext) {
    throw new Error('useFormField must be used within <FormField>');
  }

  if (!itemContext) {
    throw new Error('useFormField must be used within <FormItem>');
  }

  const fieldState = getFieldState(fieldContext.name, formState);

  return {
    id: itemContext.id,
    name: fieldContext.name,
    ...fieldState,
  };
}

function FormField<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>(props: ControllerProps<TFieldValues, TName>) {
  return (
    <FormFieldContext.Provider value={{ name: props.name }}>
      <Controller {...props} />
    </FormFieldContext.Provider>
  );
}

function FormItem({ children, className }: IFormItem) {
  const id = useId();

  return (
    <FormItemContext.Provider value={{ id }}>
      <View className={cn('mb-2', className)}>{children}</View>
    </FormItemContext.Provider>
  );
}

function FormLabel({ children, className }: IFormLabel) {
  return <FieldLabel className={className}>{children}</FieldLabel>;
}

function FormControl({ children }: IFormControl) {
  useFormField();

  return <>{children}</>;
}

function FormDescription({ children, className }: IFormDescription) {
  if (!children) {
    return null;
  }

  return (
    <Text tone="muted" variant="caption" className={cn('mb-2', className)}>
      {children}
    </Text>
  );
}

function FormMessage({ className }: IFormMessage) {
  const { error } = useFormField();
  const message = error?.message ? String(error.message) : undefined;

  return <FieldError message={message} className={className} />;
}

function FormRootError({ className }: IFormRootError) {
  const {
    formState: { errors },
  } = useFormContext();
  const rootMessage = errors.root?.message;
  const message = typeof rootMessage === 'string' ? rootMessage : undefined;

  return <FieldError message={message} className={className} />;
}

export {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormRootError,
  useFormField,
};
