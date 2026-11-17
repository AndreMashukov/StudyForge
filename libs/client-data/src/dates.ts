import { isValid, parseISO } from 'date-fns';

export const parseRequiredIsoDateString = (
  value: string | undefined,
  fieldName: string,
): Date => {
  const date = value ? parseISO(value) : new Date();
  if (!isValid(date)) {
    throw new Error(`${fieldName} must be a valid ISO date string`);
  }
  return date;
};
