import React, { useState } from 'react';
import { Button } from '../../../../components/ui/Button';
import { Input } from '../../../../components/ui/Input';
import { Label } from '../../../../components/ui/Label';
import { Globe, Loader2 } from 'lucide-react';
import { IUrlScrapingFormProps } from './IUrlScrapingForm';
import { urlScrapingFormStyles } from './UrlScrapingForm.styles';

export const UrlScrapingForm = ({ isLoading, onSubmit }: IUrlScrapingFormProps) => {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    
    onSubmit({
      url: url.trim(),
      title: title.trim() || undefined,
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
  );
};