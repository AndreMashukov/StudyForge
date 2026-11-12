'use client';

import * as React from 'react';
import { cn } from '../utils';
import { checkboxStyles } from './Checkbox.styles';
import { type ICheckbox } from './ICheckbox';

export const Checkbox = React.forwardRef<HTMLInputElement, ICheckbox>(
  (
    {
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
    },
    ref,
  ) => {
    const inputRef = React.useRef<HTMLInputElement>(null);
    const generatedId = React.useId();
    const checkboxId = id || generatedId;

    React.useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);

    React.useEffect(() => {
      if (inputRef.current) {
        inputRef.current.indeterminate = indeterminate;
      }
    }, [indeterminate]);

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      onChange?.(event.target.checked);
    };

    const isChecked = checked || indeterminate;
    const hasText = Boolean(label || description);
    const labelNode =
      typeof label === 'string' ? (
        <span className={checkboxStyles.label}>{label}</span>
      ) : (
        label
      );

    return (
      <label
        className={cn(
          hasText ? checkboxStyles.wrapper : checkboxStyles.wrapperStandalone,
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
            hasText ? checkboxStyles.box : checkboxStyles.boxStandalone,
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

        {description ? (
          <span className={checkboxStyles.text}>
            {labelNode}
            <span className={checkboxStyles.description}>{description}</span>
          </span>
        ) : (
          labelNode
        )}
      </label>
    );
  },
);
Checkbox.displayName = 'Checkbox';
