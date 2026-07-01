import React from 'react';

export type MarkdownAIAssistantState = 'idle' | 'generating' | 'done' | 'error';

export interface IMarkdownAIAssistantPanel {
  title: string;
  idleDescription: string;
  instructionPlaceholder: string;
  generateLabel: string;
  generatingLabel: string;
  applyLabel?: string;
  instructionMaxLength: number;
  aiState: MarkdownAIAssistantState;
  aiError: string | null;
  previewContent: string | null;
  previewHeader?: React.ReactNode;
  onGenerate: (instruction: string) => void;
  onApply: () => void;
  onDiscard: () => void;
  isApplyDisabled?: boolean;
  confirmBeforeApply?: boolean;
  applyConfirmTitle?: string;
  applyConfirmMessage?: string;
}
