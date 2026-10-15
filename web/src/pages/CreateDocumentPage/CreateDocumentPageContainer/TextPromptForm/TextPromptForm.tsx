import React, { useCallback, useRef, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Button } from '../../../../components/ui/Button';
import { Label } from '../../../../components/ui/Label';
import { Textarea } from '../../../../components/ui/Textarea';
import { Checkbox } from '../../../../components/ui/Checkbox';
import { Minus, Plus, Sparkles } from 'lucide-react';
import { ITextPromptFormProps } from './ITextPromptForm';
import { textPromptFormStyles } from './TextPromptForm.styles';
import { cn } from '../../../../lib/utils';
import { CompactRuleSelector } from '../../../../components/CompactRuleSelector';
import { PROMPT_DIAGRAM_COUNT_MIN, RuleApplicability } from '@shared-types';
import {
  selectDirectoryId,
  selectPromptRules,
  setPromptRules,
} from '../../../../store/slices/createDocumentPageSlice';
import type { RootState } from '../../../../store';
import {
  useEvaluatePromptDiagramCountMutation,
  useEvaluatePromptDiagramSuitabilityMutation,
} from '../../../../store/api/Documents/documentsApi';

const MIN_CHARACTERS = 10;

type DiagramEvaluationCache = {
  prompt: string;
  suitable: boolean;
};

type DiagramCountCache = {
  prompt: string;
  maxDiagrams: number;
};

export const TextPromptForm = ({ onSubmit }: ITextPromptFormProps) => {
  const dispatch = useDispatch();
  const [evaluateDiagramSuitability] = useEvaluatePromptDiagramSuitabilityMutation();
  const [evaluateDiagramCount] = useEvaluatePromptDiagramCountMutation();

  const directoryId = useSelector((state: RootState) => selectDirectoryId(state));
  const selectedRuleIds = useSelector((state: RootState) => selectPromptRules(state));

  const [prompt, setPrompt] = useState('');
  const [includeDiagrams, setIncludeDiagrams] = useState(false);
  const [showDiagramCheckbox, setShowDiagramCheckbox] = useState(false);
  const [isEvaluatingDiagrams, setIsEvaluatingDiagrams] = useState(false);
  const [isCountingDiagrams, setIsCountingDiagrams] = useState(false);
  const [maxDiagrams, setMaxDiagrams] = useState<number | null>(null);
  const [diagramCount, setDiagramCount] = useState(PROMPT_DIAGRAM_COUNT_MIN);
  const [diagramCountFailed, setDiagramCountFailed] = useState(false);

  const evaluationCacheRef = useRef<DiagramEvaluationCache | null>(null);
  const evaluationRequestIdRef = useRef(0);
  const countCacheRef = useRef<DiagramCountCache | null>(null);
  const countRequestIdRef = useRef(0);

  const clearDiagramCount = useCallback(() => {
    countRequestIdRef.current += 1;
    setIncludeDiagrams(false);
    setIsCountingDiagrams(false);
    setMaxDiagrams(null);
    setDiagramCount(PROMPT_DIAGRAM_COUNT_MIN);
    setDiagramCountFailed(false);
  }, []);

  const applySuitability = useCallback((suitable: boolean) => {
    setShowDiagramCheckbox(suitable);
    if (!suitable) {
      clearDiagramCount();
    }
  }, [clearDiagramCount]);

  const handlePromptChange = (value: string) => {
    setPrompt(value);
    setShowDiagramCheckbox(false);
    clearDiagramCount();
  };

  const handleIncludeDiagramsChange = async (checked: boolean) => {
    if (!checked) {
      clearDiagramCount();
      return;
    }

    const trimmed = prompt.trim();
    setIncludeDiagrams(true);
    setDiagramCountFailed(false);

    const cached = countCacheRef.current;
    if (cached?.prompt === trimmed) {
      setMaxDiagrams(cached.maxDiagrams);
      setDiagramCount(cached.maxDiagrams);
      return;
    }

    const requestId = countRequestIdRef.current + 1;
    countRequestIdRef.current = requestId;
    setIsCountingDiagrams(true);
    setMaxDiagrams(null);

    try {
      const result = await evaluateDiagramCount({ prompt: trimmed }).unwrap();

      if (countRequestIdRef.current !== requestId || prompt.trim() !== trimmed) {
        return;
      }

      countCacheRef.current = {
        prompt: trimmed,
        maxDiagrams: result.maxDiagrams,
      };
      setMaxDiagrams(result.maxDiagrams);
      setDiagramCount(result.maxDiagrams);
    } catch {
      if (countRequestIdRef.current !== requestId || prompt.trim() !== trimmed) {
        return;
      }
      countCacheRef.current = null;
      setDiagramCountFailed(true);
      setMaxDiagrams(PROMPT_DIAGRAM_COUNT_MIN);
      setDiagramCount(PROMPT_DIAGRAM_COUNT_MIN);
    } finally {
      if (countRequestIdRef.current === requestId) {
        setIsCountingDiagrams(false);
      }
    }
  };

  const handlePromptBlur = async () => {
    const trimmed = prompt.trim();

    if (trimmed.length < MIN_CHARACTERS) {
      evaluationCacheRef.current = null;
      countCacheRef.current = null;
      setShowDiagramCheckbox(false);
      clearDiagramCount();
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
    countCacheRef.current = null;
    clearDiagramCount();

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
      clearDiagramCount();
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

    const diagramsSelected = showDiagramCheckbox && includeDiagrams && maxDiagrams != null;
    onSubmit({
      prompt: prompt.trim(),
      ruleIds: selectedRuleIds,
      includeDiagrams: diagramsSelected,
      ...(diagramsSelected ? { diagramCount } : {}),
    });
  };

  const characterCount = prompt.length;
  const isUnderMinimum = characterCount > 0 && characterCount < MIN_CHARACTERS;

  const canSubmit = characterCount >= MIN_CHARACTERS && !isCountingDiagrams;

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
            onChange={(checked) => {
              void handleIncludeDiagramsChange(checked);
            }}
            className="mt-2"
          />
        )}
        {includeDiagrams && isCountingDiagrams && (
          <p className={textPromptFormStyles.helpText}>Choosing how many diagrams to include…</p>
        )}
        {includeDiagrams && maxDiagrams != null && (
          <div className={textPromptFormStyles.diagramStepper}>
            <span id="diagram-count-label" className={textPromptFormStyles.diagramStepperLabel}>
              Diagrams
            </span>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8"
              aria-label="Fewer diagrams"
              disabled={diagramCount <= PROMPT_DIAGRAM_COUNT_MIN}
              onClick={() => setDiagramCount((current) => Math.max(PROMPT_DIAGRAM_COUNT_MIN, current - 1))}
            >
              <Minus size={14} />
            </Button>
            <span
              className={textPromptFormStyles.diagramStepperValue}
              aria-live="polite"
              aria-labelledby="diagram-count-label"
            >
              {diagramCount}
            </span>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8"
              aria-label="More diagrams"
              disabled={diagramCount >= maxDiagrams}
              onClick={() => setDiagramCount((current) => Math.min(maxDiagrams, current + 1))}
            >
              <Plus size={14} />
            </Button>
          </div>
        )}
        {includeDiagrams && diagramCountFailed && (
          <p className={textPromptFormStyles.helpText}>
            Could not estimate a diagram count. You can still add one diagram.
          </p>
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
