'use client';

import * as React from 'react';
import { cn } from '../utils';
import { type ITextarea } from './ITextarea';
import { textareaStyles } from './Textarea.styles';

export const Textarea = React.forwardRef<HTMLTextAreaElement, ITextarea>(
  (
    {
      className,
      label,
      error,
      showCharCount = false,
      maxLength,
      helperText,
      value,
      id,
      ...props
    },
    ref,
  ) => {
    const generatedId = React.useId();
    const textareaId = id || generatedId;
    const currentLength = typeof value === 'string' ? value.length : 0;
    const isOverLimit = maxLength ? currentLength > maxLength : false;
    const hasError = Boolean(error);

    return (
      <div className={textareaStyles.container}>
        {label ? (
          <label htmlFor={textareaId} className={textareaStyles.label}>
            {label}
          </label>
        ) : null}

        <textarea
          id={textareaId}
          className={cn(
            textareaStyles.textarea,
            hasError && textareaStyles.textareaError,
            className,
          )}
          ref={ref}
          maxLength={maxLength}
          value={value}
          {...props}
        />

        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            {error ? (
              <p className={textareaStyles.error} role="alert">
                {error}
              </p>
            ) : null}
            {!error && helperText ? (
              <p className={textareaStyles.helperText}>{helperText}</p>
            ) : null}
          </div>

          {showCharCount ? (
            <p
              className={
                isOverLimit
                  ? textareaStyles.charCountOver
                  : textareaStyles.charCount
              }
            >
              {currentLength}
              {maxLength ? ` / ${maxLength}` : null}
            </p>
          ) : null}
        </div>
      </div>
    );
  },
);
Textarea.displayName = 'Textarea';
