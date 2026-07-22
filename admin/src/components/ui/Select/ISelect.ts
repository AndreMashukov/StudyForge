import type { ISelect as IBaseSelect } from '@study-forge/ui';
import type { Control, FieldPath, FieldValues } from 'react-hook-form';

export type ISelectProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> = IBaseSelect & {
  control?: Control<TFieldValues>;
  name?: TName;
  /** Maps the Radix string value before writing to RHF state. */
  transformValue?: (value: string) => unknown;
};
