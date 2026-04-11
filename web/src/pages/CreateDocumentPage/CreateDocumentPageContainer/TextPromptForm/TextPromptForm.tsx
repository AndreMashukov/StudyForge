import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Button } from '../../../../components/ui/Button';
import { Label } from '../../../../components/ui/Label';
import { Sparkles, Loader2 } from 'lucide-react';
import { ITextPromptFormProps } from './ITextPromptForm';
import { textPromptFormStyles } from './TextPromptForm.styles';
import { cn } from '../../../../lib/utils';
import { CompactRuleSelector } from '../../../../components/CompactRuleSelector';
import { RuleApplicability } from '@shared-types';
import { 
  selectDirectoryId,
  selectPromptRules,
  setPromptRules,
} from '../../../../store/slices/createDocumentPageSlice';
import type { RootState } from '../../../../store';

const MIN_CHARACTERS = 10;

export const TextPromptForm = ({ 
  isLoading, 
  progress = 0, 
  onSubmit,
}: ITextPromptFormProps) => {
  const dispatch = useDispatch();

  // Redux selectors
  const directoryId = useSelector((state: RootState) => selectDirectoryId(state));
  const selectedRuleIds = useSelector((state: RootState) => selectPromptRules(state));
  
  const [prompt, setPrompt] = useState('');

  const handleRuleSelectionChange = (ruleIds: string[]) => {
    dispatch(setPromptRules(ruleIds));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    
    onSubmit({
      prompt: prompt.trim(),
      ruleIds: selectedRuleIds,
    });
  };

  const characterCount = prompt.length;
  const isUnderMinimum = characterCount > 0 && characterCount < MIN_CHARACTERS;
  
  const canSubmit = characterCount >= MIN_CHARACTERS && !isLoading;

  return (
    <form onSubmit={handleSubmit} className={textPromptFormStyles.container}>
      {/* Prompt Input */}
      <div className={textPromptFormStyles.formGroup}>
        <div className="flex items-center justify-between">
          <Label htmlFor="prompt" className={textPromptFormStyles.label}>
            What would you like to learn about? *
          </Label>
          <span 
            className={cn(
              isUnderMinimum 
                ? textPromptFormStyles.characterCounterError 
                : textPromptFormStyles.characterCounter
            )}
          >
            {characterCount}
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
            isUnderMinimum && "border-destructive focus-visible:ring-destructive"
          )}
          disabled={isLoading}
          rows={5}
        />
        {isUnderMinimum && (
          <p className={textPromptFormStyles.characterCounterError}>
            Prompt must be at least {MIN_CHARACTERS} characters
          </p>
        )}
        {!isUnderMinimum && (
          <p className={textPromptFormStyles.helpText}>
            Describe your topic clearly. The AI will generate a comprehensive document with tables, diagrams, and detailed explanations.
          </p>
        )}
      </div>

      {/* Rule Selection */}
      {directoryId && (
        <div className={textPromptFormStyles.formGroup}>
          <CompactRuleSelector
            directoryId={directoryId}
            operation={RuleApplicability.PROMPT}
            selectedRuleIds={selectedRuleIds}
            onSelectionChange={handleRuleSelectionChange}
            label="Content Generation Rules"
          />
        </div>
      )}

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
