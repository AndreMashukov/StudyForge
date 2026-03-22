import React, { useState } from 'react';
import { Sparkles, Loader2, X } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Textarea } from '../../../components/ui/Textarea/Textarea';
import { useTheme } from '../../../contexts/ThemeContext';
import { useAIAssistant } from '../context/hooks/useAIAssistant';
import { useRuleEditorContext } from '../context/RuleEditorContext';
import { MarkdownRenderer } from '../../../components/MarkdownRenderer/MarkdownRenderer';

export const AIAssistantPanel: React.FC = () => {
  const { currentTheme } = useTheme();
  const { mode } = useRuleEditorContext();
  const { aiState, aiResult, aiError, generateWithAI, applyAIResult, discardAIResult } =
    useAIAssistant();

  const [topic, setTopic] = useState('');
  const colors = currentTheme.colors;

  const handleGenerate = () => {
    if (!topic.trim()) return;
    generateWithAI(topic.trim());
  };

  const handleRetry = () => {
    if (topic.trim()) {
      generateWithAI(topic.trim());
    }
  };

  const isDisabled = aiState === 'generating' || !topic.trim();

  return (
    <div
      className="flex flex-col h-full rounded-lg border"
      style={{
        backgroundColor: colors.card,
        borderColor: colors.border,
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-4 py-3 border-b"
        style={{ borderColor: colors.border }}
      >
        <Sparkles size={18} style={{ color: colors.primary }} />
        <h2
          className="text-sm font-semibold"
          style={{ color: colors.foreground }}
        >
          AI Assistant
        </h2>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Idle State */}
        {aiState === 'idle' && (
          <div className="space-y-3">
            <p className="text-sm" style={{ color: colors.mutedForeground }}>
              Describe a topic and let AI generate a rule for you.
            </p>
            <Textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g., Code review best practices for Python"
              rows={4}
              maxLength={15000}
              style={{
                backgroundColor: colors.background,
                borderColor: colors.border,
                color: colors.foreground,
              }}
            />
            <Button
              onClick={handleGenerate}
              disabled={isDisabled}
              className="w-full"
              style={{
                backgroundColor: colors.primary,
                color: colors.primaryForeground,
              }}
            >
              <Sparkles size={16} className="mr-2" />
              {mode === 'edit' ? 'Improve with AI' : 'Generate with AI'}
            </Button>
          </div>
        )}

        {/* Generating State */}
        {aiState === 'generating' && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2
              size={32}
              className="animate-spin"
              style={{ color: colors.primary }}
            />
            <p
              className="text-sm"
              style={{ color: colors.mutedForeground }}
            >
              Generating rule with AI...
            </p>
          </div>
        )}

        {/* Done State */}
        {aiState === 'done' && aiResult && (
          <div className="space-y-3">
            <div
              className="rounded-md border p-3 space-y-2"
              style={{
                backgroundColor: colors.background,
                borderColor: colors.border,
              }}
            >
              <h3
                className="font-medium text-sm"
                style={{ color: colors.foreground }}
              >
                {aiResult.name}
              </h3>
              {aiResult.description && (
                <p
                  className="text-xs"
                  style={{ color: colors.mutedForeground }}
                >
                  {aiResult.description}
                </p>
              )}
              <div className="max-h-96 overflow-y-auto rounded">
                <MarkdownRenderer content={aiResult.content} showToc={false} />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={applyAIResult}
                className="flex-1"
                style={{
                  backgroundColor: colors.primary,
                  color: colors.primaryForeground,
                }}
              >
                Apply to Form
              </Button>
              <Button
                variant="outline"
                onClick={discardAIResult}
                className="flex-1"
              >
                Discard
              </Button>
            </div>
          </div>
        )}

        {/* Error State */}
        {aiState === 'error' && (
          <div className="space-y-3">
            <p className="text-sm" style={{ color: colors.mutedForeground }}>
              Edit your topic and try again.
            </p>
            <Textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g., Code review best practices for Python"
              rows={4}
              maxLength={15000}
              style={{
                backgroundColor: colors.background,
                borderColor: colors.border,
                color: colors.foreground,
              }}
            />
            <div
              className="rounded-md border p-3 flex items-start gap-2"
              style={{
                backgroundColor: `${colors.destructive}10`,
                borderColor: colors.destructive,
              }}
            >
              <X size={16} className="flex-shrink-0 mt-0.5" style={{ color: colors.destructive }} />
              <p className="text-sm" style={{ color: colors.destructive }}>
                {aiError || 'An error occurred while generating the rule.'}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleGenerate}
                disabled={!topic.trim()}
                className="flex-1"
                style={{
                  backgroundColor: colors.primary,
                  color: colors.primaryForeground,
                }}
              >
                <Sparkles size={16} className="mr-2" />
                Retry
              </Button>
              <Button
                variant="outline"
                onClick={discardAIResult}
                className="flex-1"
              >
                Reset
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
