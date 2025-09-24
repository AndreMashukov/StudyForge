import React, { forwardRef } from 'react';
import { cn } from "../../../lib/utils";
import { ITextarea } from './ITextarea';
import { textareaStyles } from './Textarea.styles';

export const Textarea = forwardRef<HTMLTextAreaElement, ITextarea>(
  ({ 
    className, 
    label, 
    error, 
    showCharCount = false, 
    maxLength, 
    helperText, 
    value,
    id,
    ...props 
  }, ref) => {
    const textareaId = id || `textarea-${Math.random().toString(36).substr(2, 9)}`;
    const currentLength = typeof value === 'string' ? value.length : 0;
    const isOverLimit = maxLength ? currentLength > maxLength : false;
    const hasError = !!error;

    return (
      <div className={textareaStyles.container}>
        {label && (
          <label 
            htmlFor={textareaId} 
            className={textareaStyles.label}
          >
            {label}
          </label>
        )}
        
        <textarea
          id={textareaId}
          className={cn(
            textareaStyles.textarea,
            hasError && textareaStyles.textareaError,
            className
          )}
          ref={ref}
          maxLength={maxLength}
          value={value}
          {...props}
        />

        <div className="flex justify-between items-start gap-2">
          <div className="flex-1">
            {error && (
              <p className={textareaStyles.error} role="alert">
                {error}
              </p>
            )}
            {!error && helperText && (
              <p className={textareaStyles.helperText}>
                {helperText}
              </p>
            )}
          </div>
          
          {showCharCount && (
            <p className={isOverLimit ? textareaStyles.charCountOver : textareaStyles.charCount}>
              {currentLength}
              {maxLength && ` / ${maxLength}`}
            </p>
          )}
        </div>
      </div>
    );
  }
);

Textarea.displayName = "Textarea";