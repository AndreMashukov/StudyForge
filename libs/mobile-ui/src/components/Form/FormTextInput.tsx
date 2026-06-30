import type { FieldPath, FieldValues } from 'react-hook-form';
import { TextInputField } from '../TextInputField';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from './Form';
import type { IFormTextInput } from './IForm';

export function FormTextInput<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
  control,
  name,
  label,
  description,
  itemClassName,
  className,
  ...inputProps
}: IFormTextInput<TFieldValues, TName>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={itemClassName}>
          <FormLabel>{label}</FormLabel>
          {description ? <FormDescription>{description}</FormDescription> : null}
          <FormControl>
            <TextInputField
              {...inputProps}
              className={className}
              value={field.value ?? ''}
              onChangeText={field.onChange}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
