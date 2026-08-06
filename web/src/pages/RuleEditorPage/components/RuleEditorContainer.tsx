import React from 'react';
import { RuleEditorProvider, useRuleEditorContext } from '../context/RuleEditorContext';
import { RuleEditorHeader } from './RuleEditorHeader';
import { RuleFormSection } from './RuleFormSection';
import { AIAssistantPanel } from './AIAssistantPanel';
import { Spinner } from '../../../components/ui/Spinner';
import { cn } from '../../../lib/utils';

const RuleEditorContent: React.FC = () => {
  const { mode, isLoading } = useRuleEditorContext();

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <Spinner size="lg" variant="muted" className="mx-auto" />
          <p className="mt-4 font-medium text-muted-foreground">Loading rule...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('mx-auto space-y-6 px-4 pb-10', mode === 'create' ? 'max-w-7xl' : 'max-w-4xl')}>
      <RuleEditorHeader />

      <div className={cn(
        'relative flex flex-col gap-6',
        mode === 'create' && 'md:flex-row md:items-start',
      )}>
        <div className={cn(
          'min-w-0 flex-1 rounded-lg border border-border bg-card',
          mode === 'create' && 'md:w-[60%] md:flex-none',
        )}>
          <RuleFormSection />
        </div>

        {mode === 'create' && (
          <div className="w-full md:sticky md:top-24 md:w-[40%] md:min-h-[32rem] md:self-start">
            <AIAssistantPanel />
          </div>
        )}
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
