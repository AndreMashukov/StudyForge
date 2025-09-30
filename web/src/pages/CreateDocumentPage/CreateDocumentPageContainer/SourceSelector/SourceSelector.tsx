import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { SourceCard } from './SourceCard';
import { setSelectedSource, selectSelectedSource } from '../../../../store/slices/createDocumentPageSlice';
import { SourceType } from '../../types/ISourceTypes';
import { sourceSelectorStyles } from './SourceSelector.styles';
import type { RootState } from '../../../../store';

const sourceCards = [
  {
    id: 'website' as SourceType,
    icon: '🌐',
    title: 'Website URL',
    description: 'Scrape web content automatically',
    status: 'active' as const,
    order: 1,
  },
  {
    id: 'file' as SourceType,
    icon: '📄',
    title: 'File Upload',
    description: 'Upload MD or text file',
    status: 'active' as const,
    order: 2,
  },
  {
    id: 'textPrompt' as SourceType,
    icon: '📝',
    title: 'Text Prompt',
    description: 'Create from description',
    status: 'coming-soon' as const,
    order: 3,
  },
  {
    id: 'videoUrl' as SourceType,
    icon: '🎥',
    title: 'Video URL',
    description: 'Extract from video',
    status: 'coming-soon' as const,
    order: 4,
  },
];

export const SourceSelector = () => {
  const dispatch = useDispatch();
  const selectedSource = useSelector((state: RootState) => selectSelectedSource(state));

  const handleSourceSelect = (sourceType: SourceType) => {
    if (sourceType === selectedSource) {
      // If clicking the same source, deselect it
      dispatch(setSelectedSource(null));
    } else {
      // Select the new source
      dispatch(setSelectedSource(sourceType));
    }
  };

  return (
    <div className={sourceSelectorStyles.container}>
      <div className={sourceSelectorStyles.header}>
        <h2 className={sourceSelectorStyles.title}>Choose Your Content Source</h2>
        <p className={sourceSelectorStyles.subtitle}>
          Select how you'd like to create your document
        </p>
      </div>
      
      <div className={sourceSelectorStyles.grid}>
        {sourceCards.map((card) => (
          <SourceCard
            key={card.id}
            sourceCard={card}
            isSelected={selectedSource === card.id}
            onSelect={() => handleSourceSelect(card.id)}
          />
        ))}
      </div>
    </div>
  );
};