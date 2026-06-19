import React from 'react';
import { cn } from '../../../lib/utils';

interface IFlashcardHtmlContent {
  html: string;
  className?: string;
}

export const FlashcardHtmlContent = ({ html, className }: IFlashcardHtmlContent) => {
  if (!html) return null;

  return (
    <div
      className={cn('flashcard-html-content [&_p]:mb-2 [&_p:last-child]:mb-0 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_pre]:overflow-x-auto [&_pre]:rounded [&_pre]:bg-muted [&_pre]:p-2 [&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:border-border [&_th]:px-2 [&_th]:py-1 [&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1', className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};
