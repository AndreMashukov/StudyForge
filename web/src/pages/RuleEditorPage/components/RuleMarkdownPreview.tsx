import React from 'react';
import { MarkdownRenderer } from '../../../components/MarkdownRenderer/MarkdownRenderer';
import { useTheme } from '../../../contexts/ThemeContext';

interface RuleMarkdownPreviewProps {
  content: string;
}

export const RuleMarkdownPreview: React.FC<RuleMarkdownPreviewProps> = ({ content }) => {
  const { currentTheme } = useTheme();
  const colors = currentTheme.colors;

  return (
    <div
      className="rounded-md p-4 min-h-[200px] border overflow-y-auto"
      style={{
        backgroundColor: colors.muted,
        borderColor: colors.border,
        maxHeight: '500px',
      }}
    >
 <MarkdownRenderer content={content} showToc={false} />
    </div>
  );
};
