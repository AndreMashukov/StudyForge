'use client';

import { Select as BaseSelect } from '@study-forge/ui';
import { Controller, type FieldPath, type FieldValues } from 'react-hook-form';
import type { ISelectProps } from './ISelect';

export function Select<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
  control,
  name,
  value,
  onValueChange,
  transformValue,
  children,
  ...props
}: ISelectProps<TFieldValues, TName>) {
  if (control && name) {
    return (
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <BaseSelect
            {...props}
            value={field.value ? String(field.value) : undefined}
            onValueChange={(nextValue) => {
              const mapped = transformValue
                ? transformValue(nextValue)
                : nextValue;
              field.onChange(mapped);
              onValueChange?.(nextValue);
            }}
          >
            {children}
          </BaseSelect>
        )}
      />
    );
  }

  return (
    <BaseSelect value={value} onValueChange={onValueChange} {...props}>
      {children}
    </BaseSelect>
  );
}
