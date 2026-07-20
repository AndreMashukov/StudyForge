import React from 'react';
import { Checkbox } from '../ui/Checkbox';
import { cn } from '../../lib/utils';

export interface IBulkSelectCheckbox {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  className?: string;
  disabled?: boolean;
}

export const BulkSelectCheckbox: React.FC<IBulkSelectCheckbox> = ({
  checked,
  onCheckedChange,
  label,
  className,
  disabled = false,
}) => {
  return (
    <div
      className={cn('shrink-0', className)}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <Checkbox
        checked={checked}
        onChange={onCheckedChange}
        disabled={disabled}
        aria-label={label}
      />
    </div>
  );
};
