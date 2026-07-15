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
      className="flex flex-1 min-h-0 flex-col overflow-hidden"
      style={{ backgroundColor: colors.background }}
    >
      <RuleEditorHeader />
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4 md:flex-row">
        {/* Left column - Form */}
        <div
          className="min-h-0 w-full overflow-y-auto overscroll-contain rounded-lg border md:w-[60%]"
          style={{
            backgroundColor: colors.card,
            borderColor: colors.border,
          }}
        >
          <RuleFormSection />
        </div>

        {/* Right column - AI Assistant */}
        <div className="flex min-h-[300px] w-full flex-col md:min-h-0 md:w-[40%]">
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
