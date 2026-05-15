import React, { useState, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Button } from '../../../../components/ui/Button';
import { Textarea } from '../../../../components/ui/Textarea';
import { Input } from '../../../../components/ui/Input';
import { Label } from '../../../../components/ui/Label';
import { Globe } from 'lucide-react';
import { Spinner } from '../../../../components/ui/Spinner';
import { CompactRuleSelector } from '../../../../components/CompactRuleSelector';
import { RuleApplicability } from '@shared-types';
import {
  selectDirectoryId,
  selectPromptRules,
  setPromptRules
} from '../../../../store/slices/createDocumentPageSlice';
import { IUrlScrapingFormProps } from './IUrlScrapingForm';
import { urlScrapingFormStyles } from './UrlScrapingForm.styles';
import type { RootState } from '../../../../store';

function parseUrls(raw: string): string[] {
  return raw
    .split(/[\n,]+/)
    .map((u) => u.trim())
    .filter(Boolean);
}

function isValidUrl(urlString: string): boolean {
  try {
    const parsed = new URL(urlString);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export const UrlScrapingForm = ({ isLoading, onSubmit }: IUrlScrapingFormProps) => {
  const dispatch = useDispatch();
  const [rawUrls, setRawUrls] = useState('');
  const [title, setTitle] = useState('');

  const directoryId = useSelector((state: RootState) => selectDirectoryId(state));
  const selectedRuleIds = useSelector((state: RootState) => selectPromptRules(state));

  const handleRuleSelectionChange = (ruleIds: string[]) => {
    dispatch(setPromptRules(ruleIds));
  };

  const parsedUrls = useMemo(() => parseUrls(rawUrls), [rawUrls]);
  const invalidUrls = useMemo(() => parsedUrls.filter((u) => !isValidUrl(u)), [parsedUrls]);
  const validUrls = useMemo(() => parsedUrls.filter((u) => isValidUrl(u)), [parsedUrls]);

  const canSubmit = validUrls.length > 0 && invalidUrls.length === 0 && parsedUrls.length <= 20;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit({
      urls: validUrls,
      title: title.trim() || undefined,
      ruleIds: selectedRuleIds.length > 0 ? selectedRuleIds : undefined,
    });
  };

  const urlCountLabel =
    parsedUrls.length > 0
      ? `${parsedUrls.length} URL${parsedUrls.length !== 1 ? 's' : ''} entered`
      : '';

  return (
    <form onSubmit={handleSubmit} className={urlScrapingFormStyles.container}>
      <div className={urlScrapingFormStyles.formGroup}>
        <Label htmlFor="urls" className={urlScrapingFormStyles.label}>
          URL(s) *
        </Label>
        <Textarea
          id="urls"
          placeholder={`https://example.com/article\nhttps://youtu.be/dQw4w9WgXcQ`}
          value={rawUrls}
          onChange={(e) => setRawUrls(e.target.value)}
          disabled={isLoading}
          rows={4}
        />
        <p className={urlScrapingFormStyles.helpText}>
          One URL per line — web pages or YouTube videos. Max 20.
        </p>
        {urlCountLabel && (
          <p className="text-xs text-muted-foreground mt-1">{urlCountLabel}</p>
        )}
        {invalidUrls.length > 0 && (
          <div className="mt-2 space-y-1">
            {invalidUrls.map((u) => (
              <p key={u} className="text-xs text-destructive" role="alert">
                Invalid URL: {u}
              </p>
            ))}
          </div>
        )}
        {parsedUrls.length > 20 && (
          <p className="text-xs text-destructive mt-1" role="alert">
            Too many URLs — maximum is 20.
          </p>
        )}
      </div>

      <div className={urlScrapingFormStyles.formGroup}>
        <Label htmlFor="title" className={urlScrapingFormStyles.label}>
          Document Title (optional)
        </Label>
        <Input
          id="title"
          type="text"
          placeholder="Leave empty to use page title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={urlScrapingFormStyles.input}
          disabled={isLoading}
        />
        <p className={urlScrapingFormStyles.helpText}>
          Custom title for your document. If empty, the source title will be used.
        </p>
      </div>

      {directoryId && (
        <div className={urlScrapingFormStyles.formGroup}>
          <CompactRuleSelector
            directoryId={directoryId}
            operation={RuleApplicability.PROMPT}
            selectedRuleIds={selectedRuleIds}
            onSelectionChange={handleRuleSelectionChange}
            label="Content Generation Rules"
          />
        </div>
      )}

      {!directoryId && (
        <div className="border rounded-lg p-3 bg-muted/30 mb-4">
          <p className="text-xs text-muted-foreground text-center">
            📁 Select a directory to load applicable rules
          </p>
        </div>
      )}

      <Button
        type="submit"
        disabled={!canSubmit || isLoading}
        className={urlScrapingFormStyles.submitButton}
      >
        {isLoading ? (
          <>
            <Spinner size="xs" />
            Processing...
          </>
        ) : (
          <>
            <Globe size={16} />
            Create Document from URL{validUrls.length > 1 ? 's' : ''}
          </>
        )}
      </Button>
    </form>
  );
};
