import React from 'react';
import { cn } from '../../../lib/utils';

interface IFlashcardHtmlContent {
  html: string;
  className?: string;
}

const flashcardHtmlStyles =
  'flashcard-html-content ' +
  '[&_p]:mb-2 [&_p:last-child]:mb-0 ' +
  '[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 ' +
  '[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 ' +
  '[&_pre]:overflow-x-auto [&_pre]:rounded [&_pre]:bg-muted [&_pre]:p-2 ' +
  '[&_table]:w-full [&_table]:border-collapse ' +
  '[&_th]:border [&_th]:border-border [&_th]:px-2 [&_th]:py-1 ' +
  '[&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1 ' +
  '[&_.fc-desc]:space-y-4 ' +
  '[&_.fc-section]:rounded-lg [&_.fc-section]:border [&_.fc-section]:px-3 [&_.fc-section]:py-2.5 ' +
  '[&_.fc-heading]:text-sm [&_.fc-heading]:font-semibold [&_.fc-heading]:uppercase [&_.fc-heading]:tracking-wide [&_.fc-heading]:mb-2 ' +
  '[&_.fc-section-example]:border-accent/40 [&_.fc-section-example]:bg-accent/10 [&_.fc-section-example_.fc-heading]:text-accent ' +
  '[&_.fc-cantonese]:font-semibold ' +
  '[&_.fc-jyutping]:text-accent/90 [&_.fc-jyutping]:text-sm ' +
  '[&_.fc-gloss]:text-muted-foreground [&_.fc-gloss]:text-sm ' +
  '[&_.fc-section-synonyms]:border-primary/40 [&_.fc-section-synonyms]:bg-primary/10 [&_.fc-section-synonyms_.fc-heading]:text-primary ' +
  '[&_.fc-section-synonyms_li]:text-sm ' +
  '[&_.fc-word]:font-semibold [&_.fc-word]:text-primary ' +
  '[&_.fc-section-pronunciation]:border-border [&_.fc-section-pronunciation]:bg-muted/20 ' +
  '[&_.fc-syllable]:text-base [&_.fc-syllable]:font-bold [&_.fc-syllable]:text-primary [&_.fc-syllable]:mb-3 [&_.fc-syllable]:pb-1 [&_.fc-syllable]:border-b [&_.fc-syllable]:border-primary/30 ' +
  '[&_.fc-step]:mb-3 [&_.fc-step]:pl-2 [&_.fc-step]:border-l-2 [&_.fc-step]:border-border ' +
  '[&_.fc-step-num]:text-xs [&_.fc-step-num]:font-bold [&_.fc-step-num]:text-orange-400 ' +
  '[&_.fc-step-title]:text-sm [&_.fc-step-title]:font-semibold [&_.fc-step-title]:text-foreground ' +
  '[&_.fc-step-body]:text-sm [&_.fc-step-body]:text-muted-foreground [&_.fc-step-body]:mt-0.5 ' +
  '[&_details]:rounded-md [&_details]:border [&_details]:border-border [&_details]:px-3 [&_details]:py-2 [&_details]:mb-2 ' +
  '[&_summary]:cursor-pointer [&_summary]:font-semibold [&_summary]:text-primary';

export const FlashcardHtmlContent = ({ html, className }: IFlashcardHtmlContent) => {
  if (!html) return null;

  return (
    <div
      className={cn(flashcardHtmlStyles, className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};
