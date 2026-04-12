import React, { useRef, useEffect, useId } from 'react';
import { cn } from '../../../lib/utils';
import { ICheckbox } from './ICheckbox';
import { checkboxStyles } from './Checkbox.styles';

export const Checkbox = ({
  checked = false,
  onChange,
  indeterminate = false,
  disabled = false,
  error = false,
  label,
  description,
  id,
  className,
  ...props
}: ICheckbox) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const generatedId = useId();
  const checkboxId = id || generatedId;

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange?.(e.target.checked);
  };

  const isChecked = checked || indeterminate;

  return (
    <label
      htmlFor={checkboxId}
      className={cn(
        checkboxStyles.wrapper,
        disabled && checkboxStyles.wrapperDisabled,
        className,
      )}
    >
      {/* Hidden native input — preserves accessibility and keyboard behavior */}
      <input
        ref={inputRef}
        type="checkbox"
        id={checkboxId}
        checked={checked}
        onChange={handleChange}
        disabled={disabled}
        className="peer sr-only"
        {...props}
      />

      {/* Custom visual box */}
      <span
        aria-hidden="true"
        className={cn(
          checkboxStyles.box,
          isChecked && !error && checkboxStyles.boxChecked,
          error && !isChecked && checkboxStyles.boxError,
          error && isChecked && checkboxStyles.boxErrorChecked,
        )}
      >
        {indeterminate ? (
          <span className={checkboxStyles.indeterminateIcon} />
        ) : checked ? (
          <svg
            className={checkboxStyles.checkIcon}
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M2 6l2.5 2.5 5.5-5" />
          </svg>
        ) : null}
      </span>

      {(label || description) && (
        <>
          {label && (
            typeof label === 'string'
              ? <span className={checkboxStyles.label}>{label}</span>
              : label
          )}
          {description && <p className={checkboxStyles.description}>{description}</p>}
        </>
      )}
    </label>
  );
};

Checkbox.displayName = 'Checkbox';
