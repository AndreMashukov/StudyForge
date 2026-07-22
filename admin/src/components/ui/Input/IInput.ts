import type { IInput as IBaseInput } from '@study-forge/ui';
import type { Control, FieldPath, FieldValues } from 'react-hook-form';

export type IInputProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> = IBaseInput & {
  control?: Control<TFieldValues>;
  name?: TName;
};
