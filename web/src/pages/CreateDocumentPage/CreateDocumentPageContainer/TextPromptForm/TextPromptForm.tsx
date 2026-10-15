import React, { useCallback, useRef, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Button } from '../../../../components/ui/Button';
import { Label } from '../../../../components/ui/Label';
import { Textarea } from '../../../../components/ui/Textarea';
import { Checkbox } from '../../../../components/ui/Checkbox';
import { Sparkles } from 'lucide-react';
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
import { useEvaluatePromptDiagramSuitabilityMutation } from '../../../../store/api/Documents/documentsApi';

const MIN_CHARACTERS = 10;

type DiagramEvaluationCache = {
  prompt: string;
  suitable: boolean;
};

export const TextPromptForm = ({ onSubmit }: ITextPromptFormProps) => {
  const dispatch = useDispatch();
  const [evaluateDiagramSuitability] = useEvaluatePromptDiagramSuitabilityMutation();

  const directoryId = useSelector((state: RootState) => selectDirectoryId(state));
  const selectedRuleIds = useSelector((state: RootState) => selectPromptRules(state));

  const [prompt, setPrompt] = useState('');
  const [includeDiagrams, setIncludeDiagrams] = useState(false);
  const [showDiagramCheckbox, setShowDiagramCheckbox] = useState(false);
  const [isEvaluatingDiagrams, setIsEvaluatingDiagrams] = useState(false);

  const evaluationCacheRef = useRef<DiagramEvaluationCache | null>(null);
  const evaluationRequestIdRef = useRef(0);

  const applySuitability = useCallback((suitable: boolean) => {
    setShowDiagramCheckbox(suitable);
    setIncludeDiagrams(false);
  }, []);

  const handlePromptChange = (value: string) => {
    setPrompt(value);
    setShowDiagramCheckbox(false);
    setIncludeDiagrams(false);
  };

  const handlePromptBlur = async () => {
    const trimmed = prompt.trim();

    if (trimmed.length < MIN_CHARACTERS) {
      evaluationCacheRef.current = null;
      setShowDiagramCheckbox(false);
      setIncludeDiagrams(false);
      return;
    }

    const cached = evaluationCacheRef.current;
    if (cached?.prompt === trimmed) {
      applySuitability(cached.suitable);
      return;
    }

    const requestId = evaluationRequestIdRef.current + 1;
    evaluationRequestIdRef.current = requestId;
    setIsEvaluatingDiagrams(true);
    setShowDiagramCheckbox(false);
    setIncludeDiagrams(false);

    try {
      const result = await evaluateDiagramSuitability({ prompt: trimmed }).unwrap();

      if (evaluationRequestIdRef.current !== requestId || prompt.trim() !== trimmed) {
        return;
      }

      evaluationCacheRef.current = {
        prompt: trimmed,
        suitable: result.suitable,
      };
      applySuitability(result.suitable);
    } catch {
      if (evaluationRequestIdRef.current !== requestId || prompt.trim() !== trimmed) {
        return;
      }
      evaluationCacheRef.current = null;
      setShowDiagramCheckbox(false);
      setIncludeDiagrams(false);
    } finally {
      if (evaluationRequestIdRef.current === requestId) {
        setIsEvaluatingDiagrams(false);
      }
    }
  };

  const handleRuleSelectionChange = (ruleIds: string[]) => {
    dispatch(setPromptRules(ruleIds));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    onSubmit({
      prompt: prompt.trim(),
      ruleIds: selectedRuleIds,
      includeDiagrams: showDiagramCheckbox && includeDiagrams,
    });
  };

  const characterCount = prompt.length;
  const isUnderMinimum = characterCount > 0 && characterCount < MIN_CHARACTERS;

  const canSubmit = characterCount >= MIN_CHARACTERS;

  return (
    <form onSubmit={handleSubmit} className={textPromptFormStyles.container}>
      <div className={textPromptFormStyles.formGroup}>
        <div className="flex items-center justify-between">
          <Label htmlFor="prompt" className={textPromptFormStyles.label}>
            What would you like to learn about? *
          </Label>
          <span
            className={cn(
              isUnderMinimum
                ? textPromptFormStyles.characterCounterError
                : textPromptFormStyles.characterCounter,
            )}
          >
            {characterCount}
          </span>
        </div>
        <Textarea
          id="prompt"
          placeholder={`Example: "Explain DynamoDB provisioned capacity"\n\nDescribe what you want to learn about. Be specific for better results.`}
          value={prompt}
          onChange={(e) => handlePromptChange(e.target.value)}
          onBlur={() => {
            void handlePromptBlur();
          }}
          className={cn(
            'min-h-[120px]',
            isUnderMinimum && 'border-destructive focus-visible:ring-destructive/20',
          )}
          rows={5}
        />
        {showDiagramCheckbox && (
          <Checkbox
            id="include-diagrams"
            label="Add diagrams"
            checked={includeDiagrams}
            onChange={setIncludeDiagrams}
            className="mt-2"
          />
        )}
        {isEvaluatingDiagrams && (
          <p className={textPromptFormStyles.helpText}>Checking whether diagrams fit this topic…</p>
        )}
        {isUnderMinimum && (
          <p className={textPromptFormStyles.characterCounterError}>
            Prompt must be at least {MIN_CHARACTERS} characters
          </p>
        )}
        {!isUnderMinimum && !isEvaluatingDiagrams && (
          <p className={textPromptFormStyles.helpText}>
            Describe your topic clearly. The AI will generate a comprehensive document with tables,
            diagrams, and detailed explanations.
          </p>
        )}
      </div>

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

      <Button
        type="submit"
        disabled={!canSubmit}
        className={textPromptFormStyles.submitButton}
      >
        <Sparkles size={16} />
        Generate Document
      </Button>
    </form>
  );
};
