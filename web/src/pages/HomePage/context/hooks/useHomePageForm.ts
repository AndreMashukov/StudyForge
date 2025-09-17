import { useState } from 'react';

export const useHomePageForm = () => {
  const [url, setUrl] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setUrl('');
    setError(null);
    setIsGenerating(false);
  };

  const setGenerating = (generating: boolean) => {
    setIsGenerating(generating);
    if (generating) {
      setError(null);
    }
  };

  return {
    urlForm: {
      url,
      setUrl,
      isGenerating,
      error,
    },
    actions: {
      resetForm,
      setGenerating,
      setError,
    },
  };
};