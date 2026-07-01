import React from 'react';
import { AI_REVISION_INSTRUCTION_MAX } from '@shared-types';
import { MarkdownAIAssistantPanel } from '../../../components/MarkdownAIAssistantPanel';
import { useAIAssistant } from '../context/hooks/useAIAssistant';
import { useRuleEditorContext } from '../context/RuleEditorContext';

export const AIAssistantPanel: React.FC = () => {
  const { mode } = useRuleEditorContext();
  const { aiState, aiResult, aiError, generateWithAI, applyAIResult, discardAIResult } =
    useAIAssistant();

  return (
    <MarkdownAIAssistantPanel
      title="AI Assistant"
      idleDescription="Describe a topic and let AI generate a rule for you."
      instructionPlaceholder="e.g., Code review best practices for Python"
      generateLabel={mode === 'edit' ? 'Improve with AI' : 'Generate with AI'}
      generatingLabel="Generating rule with AI..."
      applyLabel="Apply to Form"
      instructionMaxLength={AI_REVISION_INSTRUCTION_MAX}
      aiState={aiState}
      aiError={aiError}
      previewContent={aiResult?.content ?? null}
      previewHeader={
        aiResult ? (
          <>
            <h3 className="font-medium text-sm">{aiResult.name}</h3>
            {aiResult.description ? (
              <p className="text-xs text-muted-foreground">{aiResult.description}</p>
            ) : null}
          </>
        ) : undefined
      }
      onGenerate={generateWithAI}
      onApply={applyAIResult}
      onDiscard={discardAIResult}
    />
  );
};
