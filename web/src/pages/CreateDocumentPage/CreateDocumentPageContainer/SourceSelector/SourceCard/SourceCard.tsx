import React from 'react';
import { Button } from '../../../../../components/ui/Button';
import { ISourceCard } from '../../types/ISourceTypes';
import { sourceCardStyles } from './SourceCard.styles';
import { cn } from '../../../../../lib/utils';

interface ISourceCardProps {
  sourceCard: ISourceCard;
  isSelected: boolean;
  onSelect: () => void;
}

export const SourceCard = ({ sourceCard, isSelected, onSelect }: ISourceCardProps) => {
  const isDisabled = sourceCard.status === 'coming-soon' || sourceCard.status === 'disabled';
  
  const handleClick = () => {
    if (!isDisabled) {
      onSelect();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  return (
    <div
      className={cn(
        sourceCardStyles.container,
        isSelected && sourceCardStyles.selected,
        isDisabled && sourceCardStyles.disabled
      )}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={isDisabled ? -1 : 0}
      role="button"
      aria-pressed={isSelected}
      aria-disabled={isDisabled}
    >
      <div className={sourceCardStyles.icon}>
        {sourceCard.icon}
      </div>
      
      <div className={sourceCardStyles.content}>
        <h3 className={sourceCardStyles.title}>
          {sourceCard.title}
        </h3>
        <p className={sourceCardStyles.description}>
          {sourceCard.description}
        </p>
      </div>
      
      <div className={sourceCardStyles.footer}>
        {sourceCard.status === 'active' ? (
          <Button
            variant={isSelected ? "default" : "outline"}
            size="sm"
            className={sourceCardStyles.button}
            tabIndex={-1} // Prevent double tabbing
          >
            {isSelected ? '✓ Selected' : 'Select'}
          </Button>
        ) : (
          <span className={sourceCardStyles.comingSoon}>
            Coming Soon
          </span>
        )}
      </div>
    </div>
  );
};