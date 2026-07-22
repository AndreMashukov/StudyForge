'use client';

import { Input as BaseInput } from '@study-forge/ui';
import { Controller, type FieldPath, type FieldValues } from 'react-hook-form';
import type { IInputProps } from './IInput';

export function Input<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({ control, name, ...props }: IInputProps<TFieldValues, TName>) {
  if (control && name) {
    return (
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <BaseInput
            {...props}
            {...field}
            value={field.value ?? ''}
          />
        )}
      />
    );
  }

  return <BaseInput {...props} />;
}
