import React from 'react';
import './animations.css';
import { useDispatch, useSelector } from 'react-redux';
import { SourceCard } from './SourceCard';
import { setSelectedSource, selectSelectedSource } from '../../../../store/slices/createDocumentPageSlice';
import { ISourceCard, SourceType } from '../../types/ISourceTypes';
import { sourceSelectorStyles } from './SourceSelector.styles';
import type { RootState } from '../../../../store';

const sourceCards: ISourceCard[] = [
  {
    id: 'file',
    icon: '📄',
    title: 'File Upload',
    description: 'Upload MD or text file',
    status: 'active',
    order: 1,
  },
  {
    id: 'pasteText',
    icon: '📋',
    title: 'Paste Text',
    description: 'Paste existing text or notes',
    status: 'active',
    order: 2,
  },
  {
    id: 'website',
    icon: '🌐',
    title: 'Website URL',
    description: 'From any URL or link',
    status: 'active',
    order: 3,
  },
  {
    id: 'textPrompt',
    icon: '📝',
    title: 'Text Prompt',
    description: 'Create from description',
    status: 'active',
    order: 4,
  },
];

export const SourceSelector = () => {
  const dispatch = useDispatch();
  const selectedSource = useSelector((state: RootState) => selectSelectedSource(state));

  const handleSourceSelect = (sourceType: SourceType) => {
    if (sourceType === selectedSource) {
      dispatch(setSelectedSource(null));
    } else {
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
