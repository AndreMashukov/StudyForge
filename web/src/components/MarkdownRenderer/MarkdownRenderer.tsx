/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useMemo, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkToc from 'remark-toc';
import { IMarkdownRenderer, TocItem } from './IMarkdownRenderer';
import { CodeBlock } from './CodeBlock';
import { markdownStyles, getMarkdownClasses } from './MarkdownRenderer.styles';
import { cn } from '../../lib/utils';

// Utility function to generate TOC from markdown headings
const generateTocFromContent = (content: string): TocItem[] => {
  const headingRegex = /^(#{1,6})\s+(.+)$/gm;
  const headings: Array<{ level: number; title: string; id: string }> = [];
  
  let match;
  while ((match = headingRegex.exec(content)) !== null) {
    const level = match[1].length;
    const title = match[2].trim();
    const id = title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    
    headings.push({ level, title, id });
  }

  // Convert flat array to nested structure
  const buildNestedToc = (items: typeof headings): TocItem[] => {
    const result: TocItem[] = [];
    const stack: TocItem[] = [];

    for (const item of items) {
      const tocItem: TocItem = {
        id: item.id,
        title: item.title,
        level: item.level,
        children: [],
      };

      // Find the appropriate parent
      while (stack.length > 0 && stack[stack.length - 1].level >= item.level) {
        stack.pop();
      }

      if (stack.length === 0) {
        result.push(tocItem);
      } else {
        const parent = stack[stack.length - 1];
        if (!parent.children) {
          parent.children = [];
        }
        parent.children.push(tocItem);
      }

      stack.push(tocItem);
    }

    return result;
  };

  return buildNestedToc(headings);
};

// Helper function to generate heading IDs
const generateHeadingId = (children: React.ReactNode): string => {
  return String(children)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
};

export const MarkdownRenderer = ({ 
  content, 
  className,
  showToc = true,
  onTocGenerated 
}: IMarkdownRenderer) => {
  
  // Generate TOC from content
  const toc = useMemo(() => generateTocFromContent(content), [content]);
  
  // Call TOC callback in useEffect to avoid state updates during render
  useEffect(() => {
    if (onTocGenerated) {
      onTocGenerated(toc);
    }
  }, [toc, onTocGenerated]);

  // Custom components for markdown elements
  const components = useMemo(() => ({
    // Headings with automatic IDs for TOC navigation
    h1: ({ children, ...props }: any) => (
      <h1 id={generateHeadingId(children)} className={getMarkdownClasses('h1')} {...props}>
        {children}
      </h1>
    ),
    h2: ({ children, ...props }: any) => (
      <h2 id={generateHeadingId(children)} className={getMarkdownClasses('h2')} {...props}>
        {children}
      </h2>
    ),
    h3: ({ children, ...props }: any) => (
      <h3 id={generateHeadingId(children)} className={getMarkdownClasses('h3')} {...props}>
        {children}
      </h3>
    ),
    h4: ({ children, ...props }: any) => (
      <h4 id={generateHeadingId(children)} className={getMarkdownClasses('h4')} {...props}>
        {children}
      </h4>
    ),
    h5: ({ children, ...props }: any) => (
      <h5 id={generateHeadingId(children)} className={getMarkdownClasses('h5')} {...props}>
        {children}
      </h5>
    ),
    h6: ({ children, ...props }: any) => (
      <h6 id={generateHeadingId(children)} className={getMarkdownClasses('h6')} {...props}>
        {children}
      </h6>
    ),
    
    // Text elements
    p: ({ children, ...props }: any) => (
      <p className={getMarkdownClasses('paragraph')} {...props}>
        {children}
      </p>
    ),
    strong: ({ children, ...props }: any) => (
      <strong className={getMarkdownClasses('strong')} {...props}>
        {children}
      </strong>
    ),
    em: ({ children, ...props }: any) => (
      <em className={getMarkdownClasses('em')} {...props}>
        {children}
      </em>
    ),
    
    // Lists
    ul: ({ children, ...props }: any) => (
      <ul className={getMarkdownClasses('ul')} {...props}>
        {children}
      </ul>
    ),
    ol: ({ children, ...props }: any) => (
      <ol className={getMarkdownClasses('ol')} {...props}>
        {children}
      </ol>
    ),
    li: ({ children, ...props }: any) => (
      <li className={getMarkdownClasses('li')} {...props}>
        {children}
      </li>
    ),
    
    // Links
    a: ({ children, href, ...props }: any) => (
      <a 
        href={href} 
        className={getMarkdownClasses('a')} 
        target={href?.startsWith('http') ? '_blank' : undefined}
        rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
        {...props}
      >
        {children}
      </a>
    ),
    
    // Code
    code: ({ children, className, ...props }: any) => {
      const match = /language-(\w+)/.exec(className || '');
      const language = match ? match[1] : undefined;
      
      if (language && children && typeof children === 'string') {
        // Block code with syntax highlighting
        return (
          <CodeBlock
            code={children.trim()}
            language={language}
            showCopyButton={true}
          />
        );
      }
      
      // Inline code
      return (
        <code className={getMarkdownClasses('inlineCode')} {...props}>
          {children}
        </code>
      );
    },
    
    // Blockquote
    blockquote: ({ children, ...props }: any) => (
      <blockquote className={getMarkdownClasses('blockquote')} {...props}>
        {children}
      </blockquote>
    ),
    
    // Tables
    table: ({ children, ...props }: any) => (
      <div className="overflow-x-auto mb-4">
        <table className={getMarkdownClasses('table')} {...props}>
          {children}
        </table>
      </div>
    ),
    th: ({ children, ...props }: any) => (
      <th className={getMarkdownClasses('th')} {...props}>
        {children}
      </th>
    ),
    td: ({ children, ...props }: any) => (
      <td className={getMarkdownClasses('td')} {...props}>
        {children}
      </td>
    ),
    
    // Horizontal rule
    hr: (props: any) => <hr className={getMarkdownClasses('hr')} {...props} />,
    
    // Images
    img: ({ src, alt, ...props }: any) => (
      <img
        src={src}
        alt={alt}
        className={getMarkdownClasses('img')}
        loading="lazy"
        {...props}
      />
    ),
  }), []);

  return (
    <div className={cn(markdownStyles.container, className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkToc]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};