import React, { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { useTheme } from '../../../contexts/ThemeContext';
import { vs, vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Copy, Check } from 'lucide-react';
import { Button } from '../../ui/Button';
import { ICodeBlock } from './ICodeBlock';
import { cn } from '../../../lib/utils';

export const CodeBlock = ({ 
  code, 
  language, 
  className,
  showCopyButton = true 
}: ICodeBlock) => {
  const [isCopied, setIsCopied] = useState(false);
  const { isDark } = useTheme();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  const syntaxTheme = isDark ? vscDarkPlus : vs;

  const customStyle = {
    ...syntaxTheme,
    'pre[class*="language-"]': {
      ...syntaxTheme['pre[class*="language-"]'],
      background: 'hsl(var(--muted))',
      border: '1px solid hsl(var(--border))',
      borderRadius: '0.375rem',
      margin: 0,
      padding: '1rem',
    },
    'code[class*="language-"]': {
      ...syntaxTheme['code[class*="language-"]'],
      background: 'transparent',
      color: 'hsl(var(--foreground))',
    },
  };

  return (
    <div className={cn("relative group mb-4 overflow-hidden", className)}>
      {showCopyButton && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopy}
          className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label="Copy code"
        >
          {isCopied ? (
            <>
              <Check size={14} />
              <span className="sr-only">Copied!</span>
            </>
          ) : (
            <>
              <Copy size={14} />
              <span className="sr-only">Copy code</span>
            </>
          )}
        </Button>
      )}
      
      {/* @ts-expect-error - SyntaxHighlighter type issue with React 19 */}
      <SyntaxHighlighter
        language={language || 'text'}
        style={customStyle}
        customStyle={{
          background: 'hsl(var(--muted))',
          border: '1px solid hsl(var(--border))',
          borderRadius: '0.375rem',
          margin: 0,
          padding: '1rem',
          fontSize: '0.875rem',
        }}
        codeTagProps={{
          style: {
            background: 'transparent',
            color: 'hsl(var(--foreground))',
            fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
            whiteSpace: 'pre',
          }
        }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
};