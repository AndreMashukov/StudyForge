import React, { useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import { Button } from '../ui/Button';
import { Textarea } from '../ui/Textarea/Textarea';
import { useTheme } from '../../contexts/ThemeContext';
import { MarkdownRenderer } from '../MarkdownRenderer/MarkdownRenderer';
import { Spinner } from '../ui/Spinner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/Dialog';
import { IMarkdownAIAssistantPanel } from './IMarkdownAIAssistantPanel';

export const MarkdownAIAssistantPanel: React.FC<IMarkdownAIAssistantPanel> = ({
  title,
  idleDescription,
  instructionPlaceholder,
  generateLabel,
  generatingLabel,
  applyLabel = 'Apply',
  instructionMaxLength,
  aiState,
  aiError,
  previewContent,
  previewHeader,
  onGenerate,
  onApply,
  onDiscard,
  isApplyDisabled = false,
  confirmBeforeApply = false,
  applyConfirmTitle = 'Apply changes?',
  applyConfirmMessage = 'This will replace the current content.',
}) => {
  const { currentTheme } = useTheme();
  const colors = currentTheme.colors;
  const [instruction, setInstruction] = useState('');
  const [showApplyConfirm, setShowApplyConfirm] = useState(false);

  const isGenerating = aiState === 'generating';

  const handleGenerate = () => {
    const trimmed = instruction.trim();
    if (!trimmed || isGenerating) return;
    onGenerate(trimmed);
  };

  const handleApplyClick = () => {
    if (confirmBeforeApply) {
      setShowApplyConfirm(true);
      return;
    }
    onApply();
  };

  const handleConfirmApply = () => {
    setShowApplyConfirm(false);
    onApply();
  };

  return (
    <>
      <div
        className="flex flex-col h-full rounded-lg border"
        style={{
          backgroundColor: colors.card,
          borderColor: colors.border,
        }}
      >
        <div
          className="flex items-center gap-2 px-4 py-3 border-b"
          style={{ borderColor: colors.border }}
        >
          <Sparkles size={18} style={{ color: colors.primary }} />
          <h2 className="text-sm font-semibold" style={{ color: colors.foreground }}>
            {title}
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-4">
          {(aiState === 'idle' || aiState === 'error' || isGenerating) && (
            <div className="space-y-3">
              <p className="text-sm" style={{ color: colors.mutedForeground }}>
                {idleDescription}
              </p>
              <Textarea
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder={instructionPlaceholder}
                rows={4}
                maxLength={instructionMaxLength}
                disabled={isGenerating}
                style={{
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                  color: colors.foreground,
                }}
              />
              {aiState === 'error' && (
                <div
                  className="rounded-md border p-3 flex items-start gap-2"
                  style={{
                    backgroundColor: `${colors.destructive}10`,
                    borderColor: colors.destructive,
                  }}
                >
                  <X
                    size={16}
                    className="flex-shrink-0 mt-0.5"
                    style={{ color: colors.destructive }}
                  />
                  <p className="text-sm" style={{ color: colors.destructive }}>
                    {aiError || 'An error occurred while generating with AI.'}
                  </p>
                </div>
              )}
              <Button
                onClick={handleGenerate}
                disabled={!instruction.trim() || isGenerating}
                className="w-full"
                style={{
                  backgroundColor: colors.primary,
                  color: colors.primaryForeground,
                }}
              >
                {isGenerating ? (
                  <>
                    <Spinner size="xs" variant="on-primary" className="mr-2" />
                    {generatingLabel}
                  </>
                ) : (
                  <>
                    <Sparkles size={16} className="mr-2" />
                    {aiState === 'error' ? 'Retry' : generateLabel}
                  </>
                )}
              </Button>
              {aiState === 'error' && (
                <Button
                  variant="outline"
                  onClick={onDiscard}
                  disabled={isGenerating}
                  className="w-full"
                >
                  Reset
                </Button>
              )}
            </div>
          )}

          {aiState === 'done' && previewContent && (
            <div className="space-y-3">
              <div
                className="rounded-md border p-3 space-y-2"
                style={{
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                }}
              >
                {previewHeader}
                <div className="max-h-96 overflow-y-auto rounded">
                  <MarkdownRenderer content={previewContent} showToc={false} />
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleApplyClick}
                  disabled={isApplyDisabled}
                  className="flex-1"
                  style={{
                    backgroundColor: colors.primary,
                    color: colors.primaryForeground,
                  }}
                >
                  {applyLabel}
                </Button>
                <Button
                  variant="outline"
                  onClick={onDiscard}
                  disabled={isApplyDisabled}
                  className="flex-1"
                >
                  Discard
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <Dialog open={showApplyConfirm} onOpenChange={setShowApplyConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{applyConfirmTitle}</DialogTitle>
            <DialogDescription>{applyConfirmMessage}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowApplyConfirm(false)}
              disabled={isApplyDisabled}
            >
              Cancel
            </Button>
            <Button onClick={handleConfirmApply} disabled={isApplyDisabled}>
              {applyLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
