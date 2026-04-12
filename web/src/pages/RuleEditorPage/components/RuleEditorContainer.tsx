import React from 'react';
import { RuleEditorProvider, useRuleEditorContext } from '../context/RuleEditorContext';
import { RuleEditorHeader } from './RuleEditorHeader';
import { RuleFormSection } from './RuleFormSection';
import { AIAssistantPanel } from './AIAssistantPanel';
import { useTheme } from '../../../contexts/ThemeContext';
import { Spinner } from '../../../components/ui/Spinner';

const RuleEditorContent: React.FC = () => {
  const { currentTheme } = useTheme();
  const { isLoading } = useRuleEditorContext();
  const colors = currentTheme.colors;

  if (isLoading) {
    return (
      <div
        className="flex items-center justify-center min-h-[400px]"
        style={{ backgroundColor: colors.background }}
      >
        <div className="text-center">
          <Spinner size="lg" variant="muted" className="mx-auto" />
          <p
            className="mt-4 font-medium"
            style={{ color: colors.mutedForeground }}
          >
            Loading rule...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col h-full"
      style={{ backgroundColor: colors.background }}
    >
      <RuleEditorHeader />
      <div className="flex-1 flex flex-col md:flex-row gap-4 p-4 min-h-0">
        {/* Left column - Form */}
        <div className="w-full md:w-[60%] overflow-y-auto rounded-lg border"
          style={{
            backgroundColor: colors.card,
            borderColor: colors.border,
          }}
        >
          <RuleFormSection />
        </div>

        {/* Right column - AI Assistant */}
        <div className="w-full md:w-[40%] min-h-[300px] md:min-h-0">
          <AIAssistantPanel />
        </div>
      </div>
    </div>
  );
};

export const RuleEditorContainer: React.FC = () => {
  return (
    <RuleEditorProvider>
      <RuleEditorContent />
    </RuleEditorProvider>
  );
};
