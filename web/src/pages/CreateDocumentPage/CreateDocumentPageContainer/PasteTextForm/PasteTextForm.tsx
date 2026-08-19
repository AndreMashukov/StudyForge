import React, { useState } from 'react';
import { Button } from '../../../../components/ui/Button';
import { Textarea } from '../../../../components/ui/Textarea';
import { Label } from '../../../../components/ui/Label';
import { ClipboardPaste } from 'lucide-react';
import { IPasteTextFormProps } from './IPasteTextForm';
import { pasteTextFormStyles } from './PasteTextForm.styles';
import { cn } from '../../../../lib/utils';

const MIN_CHARACTERS = 10;
const MAX_CHARACTERS = 100_000;

export const PasteTextForm = ({ onSubmit }: IPasteTextFormProps) => {
  const [content, setContent] = useState('');

  const characterCount = content.length;
  const isOverMaximum = characterCount > MAX_CHARACTERS;
  const isUnderMinimum = characterCount > 0 && characterCount < MIN_CHARACTERS;
  const canSubmit = characterCount >= MIN_CHARACTERS && !isOverMaximum;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit({ content: content.trim() });
  };

  return (
    <form onSubmit={handleSubmit} className={pasteTextFormStyles.container}>
      <div className={pasteTextFormStyles.formGroup}>
        <div className="flex items-center justify-between">
          <Label htmlFor="paste-content" className={pasteTextFormStyles.label}>
            Text content *
          </Label>
          <span
            className={cn(
              isOverMaximum || isUnderMinimum
                ? pasteTextFormStyles.characterCounterError
                : pasteTextFormStyles.characterCounter,
            )}
          >
            {characterCount.toLocaleString()} / {MAX_CHARACTERS.toLocaleString()}
          </span>
        </div>
        <Textarea
          id="paste-content"
          placeholder="Paste your notes, article, or markdown here..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className={pasteTextFormStyles.textarea}
        />
        {isOverMaximum && (
          <p className={pasteTextFormStyles.characterCounterError}>
            Text must be at most {MAX_CHARACTERS.toLocaleString()} characters
          </p>
        )}
        {isUnderMinimum && (
          <p className={pasteTextFormStyles.characterCounterError}>
            Text must be at least {MIN_CHARACTERS} characters
          </p>
        )}
        {!isOverMaximum && !isUnderMinimum && (
          <p className={pasteTextFormStyles.helpText}>
            Convert existing text to a StudyForge document while keeping the source structure.
          </p>
        )}
      </div>

      <Button
        type="submit"
        disabled={!canSubmit}
        className={pasteTextFormStyles.submitButton}
      >
        <ClipboardPaste size={16} />
        Create Document from Text
      </Button>
    </form>
  );
};
