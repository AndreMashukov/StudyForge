'use client';

import type { IProviderAvailableModel, LlmModality } from '@shared-types';
import type { Control, FieldPath, FieldValues } from 'react-hook-form';
import {
  filterModelsForModality,
  isModelInCatalogForModality,
} from '../../../lib/provider-model-catalog-ui';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/Select';

const EMPTY_MODEL_VALUE = '__none__';

export interface IConnectionModelSelectProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> {
  control: Control<TFieldValues>;
  name: TName;
  models: IProviderAvailableModel[];
  modality: LlmModality;
  currentValue?: string;
  ariaLabel: string;
  disabled?: boolean;
  emptyHint?: string;
  allowEmpty?: boolean;
}

export function ConnectionModelSelect<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
  control,
  name,
  models,
  modality,
  currentValue = '',
  ariaLabel,
  disabled = false,
  emptyHint = 'Test or save the provider connection to sync models.',
  allowEmpty = false,
}: IConnectionModelSelectProps<TFieldValues, TName>) {
  const catalogModels = filterModelsForModality(models, modality);
  const hasCatalog = models.length > 0;
  const currentIsValid =
    currentValue.length > 0 &&
    isModelInCatalogForModality(models, currentValue, modality);
  const showInvalidOption =
    currentValue.length > 0 && hasCatalog && !currentIsValid;

  if (!hasCatalog) {
    return (
      <div className="space-y-1">
        <Select control={control} name={name} disabled>
          <SelectTrigger aria-label={ariaLabel} disabled>
            <SelectValue placeholder="No models synced" />
          </SelectTrigger>
          <SelectContent>
            {currentValue ? (
              <SelectItem value={currentValue}>{currentValue}</SelectItem>
            ) : (
              <SelectItem value={EMPTY_MODEL_VALUE} disabled>
                No models synced
              </SelectItem>
            )}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">{emptyHint}</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <Select
        control={control}
        name={name}
        disabled={disabled}
        transformValue={(nextValue) =>
          nextValue === EMPTY_MODEL_VALUE ? '' : nextValue
        }
      >
        <SelectTrigger aria-label={ariaLabel} disabled={disabled}>
          <SelectValue placeholder="Select model" />
        </SelectTrigger>
        <SelectContent>
          {allowEmpty ? (
            <SelectItem value={EMPTY_MODEL_VALUE}>None</SelectItem>
          ) : null}
          {showInvalidOption ? (
            <SelectItem value={currentValue}>
              {currentValue} (not in catalog)
            </SelectItem>
          ) : null}
          {catalogModels.map((model) => (
            <SelectItem key={model.id} value={model.id}>
              {model.label === model.id ? model.id : `${model.label} (${model.id})`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {showInvalidOption ? (
        <p className="text-xs text-destructive">
          Selected model is not in the uploaded catalog for {modality}.
        </p>
      ) : null}
      {catalogModels.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No uploaded models support the {modality} modality.
        </p>
      ) : null}
    </div>
  );
}
