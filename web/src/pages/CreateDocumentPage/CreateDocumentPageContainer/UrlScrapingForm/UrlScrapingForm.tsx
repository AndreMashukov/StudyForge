import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Button } from '../../../../components/ui/Button';
import { Input } from '../../../../components/ui/Input';
import { Label } from '../../../../components/ui/Label';
import { Globe, Loader2 } from 'lucide-react';
import { RuleSelector } from '../../../../components/RuleSelector';
import { RuleApplicability } from '@shared-types';
import { 
  selectDirectoryId, 
  selectScrapingRules,
  setScrapingRules 
} from '../../../../store/slices/createDocumentPageSlice';
import { IUrlScrapingFormProps } from './IUrlScrapingForm';
import { urlScrapingFormStyles } from './UrlScrapingForm.styles';
import type { RootState } from '../../../../store';

export const UrlScrapingForm = ({ isLoading, onSubmit }: IUrlScrapingFormProps) => {
  const dispatch = useDispatch();
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');

  // Redux selectors
  const directoryId = useSelector((state: RootState) => selectDirectoryId(state));
  const selectedRuleIds = useSelector((state: RootState) => selectScrapingRules(state));

  const handleRuleSelectionChange = (ruleIds: string[]) => {
    dispatch(setScrapingRules(ruleIds));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    
    onSubmit({
      url: url.trim(),
      title: title.trim() || undefined,
      ruleIds: selectedRuleIds.length > 0 ? selectedRuleIds : undefined,
    });
  };

  const isValidUrl = (urlString: string) => {
    try {
      new URL(urlString);
      return true;
    } catch {
      return false;
    }
  };

  const canSubmit = url.trim() && isValidUrl(url.trim());

  return (
    <div className="grid grid-cols-1 md:grid-cols-[7fr_3fr] gap-6">
      {/* Form Section (70%) */}
      <form onSubmit={handleSubmit} className={urlScrapingFormStyles.container}>
        <div className={urlScrapingFormStyles.formGroup}>
          <Label htmlFor="url" className={urlScrapingFormStyles.label}>
            Website URL *
          </Label>
          <Input
            id="url"
            type="url"
            placeholder="https://example.com/article"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className={urlScrapingFormStyles.input}
            disabled={isLoading}
          />
          <p className={urlScrapingFormStyles.helpText}>
            Enter the URL of the webpage you want to convert to a document
          </p>
        </div>

        <div className={urlScrapingFormStyles.formGroup}>
          <Label htmlFor="title" className={urlScrapingFormStyles.label}>
            Document Title (optional)
          </Label>
          <Input
            id="title"
            type="text"
            placeholder="Leave empty to use webpage title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={urlScrapingFormStyles.input}
            disabled={isLoading}
          />
          <p className={urlScrapingFormStyles.helpText}>
            Custom title for your document. If empty, we'll use the webpage title.
          </p>
        </div>

        <Button
          type="submit"
          disabled={!canSubmit || isLoading}
          className={urlScrapingFormStyles.submitButton}
        >
          {isLoading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Scraping Content...
            </>
          ) : (
            <>
              <Globe size={16} />
              Create Document from URL
            </>
          )}
        </Button>
      </form>

      {/* Rule Selector Section (30%) */}
      <div className="space-y-4">
        {directoryId ? (
          <RuleSelector
            directoryId={directoryId}
            operation={RuleApplicability.SCRAPING}
            selectedRuleIds={selectedRuleIds}
            onSelectionChange={handleRuleSelectionChange}
            compact={true}
          />
        ) : (
          <div className="border rounded-lg p-4 bg-muted/30">
            <p className="text-sm text-muted-foreground text-center">
              <span role="img" aria-label="folder">📁</span> Select a directory to load applicable rules
            </p>
          </div>
        )}
        
        <div className="text-xs text-muted-foreground p-3 bg-accent/10 rounded-md border">
          <p className="font-medium mb-1">
            <span role="img" aria-label="info">ℹ️</span> About Rules
          </p>
          <p>
            Rules guide how content is scraped and processed. 
            They are automatically loaded based on the selected directory.
          </p>
        </div>
      </div>
    </div>
  );
};