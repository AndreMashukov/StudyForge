import React, { useState } from 'react';
import { Button } from '../../../../components/ui/Button';
import { Label } from '../../../../components/ui/Label';
import { Sparkles, Loader2 } from 'lucide-react';
import { ITextPromptFormProps } from './ITextPromptForm';
import { textPromptFormStyles } from './TextPromptForm.styles';
import { cn } from '../../../../lib/utils';

const MAX_CHARACTERS = 10000;
const MIN_CHARACTERS = 10;

export const TextPromptForm = ({ isLoading, progress = 0, onSubmit }: ITextPromptFormProps) => {
  const [prompt, setPrompt] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    
    onSubmit({
      prompt: prompt.trim(),
    });
  };

  const characterCount = prompt.length;
  const isOverLimit = characterCount > MAX_CHARACTERS;
  const isUnderMinimum = characterCount > 0 && characterCount < MIN_CHARACTERS;
  const canSubmit = characterCount >= MIN_CHARACTERS && characterCount <= MAX_CHARACTERS && !isLoading;

  return (
    <form onSubmit={handleSubmit} className={textPromptFormStyles.container}>
      <div className={textPromptFormStyles.formGroup}>
        <div className="flex items-center justify-between">
          <Label htmlFor="prompt" className={textPromptFormStyles.label}>
            What would you like to learn about? *
          </Label>
          <span 
            className={cn(
              isOverLimit || isUnderMinimum 
                ? textPromptFormStyles.characterCounterError 
                : textPromptFormStyles.characterCounter
            )}
          >
            {characterCount} / {MAX_CHARACTERS}
          </span>
        </div>
        <textarea
          id="prompt"
          placeholder={`Example: "Explain DynamoDB provisioned capacity"\n\nDescribe what you want to learn about. Be specific for better results.`}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className={cn(
            textPromptFormStyles.textarea,
            "px-3 py-2 text-sm rounded-md border border-input bg-background ring-offset-background",
            "placeholder:text-muted-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-50",
            (isOverLimit || isUnderMinimum) && "border-destructive focus-visible:ring-destructive"
          )}
          disabled={isLoading}
          rows={5}
        />
        {isOverLimit && (
          <p className={textPromptFormStyles.characterCounterError}>
            Prompt cannot exceed {MAX_CHARACTERS} characters
          </p>
        )}
        {isUnderMinimum && (
          <p className={textPromptFormStyles.characterCounterError}>
            Prompt must be at least {MIN_CHARACTERS} characters
          </p>
        )}
        {!isOverLimit && !isUnderMinimum && (
          <p className={textPromptFormStyles.helpText}>
            Describe your topic clearly. The AI will generate a comprehensive document with tables, diagrams, and detailed explanations.
          </p>
        )}
      </div>

      {isLoading && progress > 0 && (
        <div className={textPromptFormStyles.progressContainer}>
          <div className={textPromptFormStyles.progressBar}>
            <div 
              className={textPromptFormStyles.progressFill}
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className={textPromptFormStyles.progressText}>
            Generating your document... This may take 10-30 seconds
          </p>
        </div>
      )}

      <Button
        type="submit"
        disabled={!canSubmit}
        className={textPromptFormStyles.submitButton}
      >
        {isLoading ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Generating Document...
          </>
        ) : (
          <>
            <Sparkles size={16} />
            Generate Document
          </>
        )}
      </Button>
    </form>
  );
};

