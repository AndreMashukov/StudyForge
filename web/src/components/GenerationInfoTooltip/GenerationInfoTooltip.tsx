import React from 'react';
import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/Tooltip';
import { formatGenerationDuration } from '../../utils/dateUtils';
import { IGenerationInfoTooltip } from './IGenerationInfoTooltip';

export const GenerationInfoTooltip: React.FC<IGenerationInfoTooltip> = ({
  createdAt,
  completedAt,
  ruleNames,
  generationModel,
}) => {
  const generationTime = formatGenerationDuration(createdAt, completedAt);
  const hasRules = ruleNames.length > 0;
  const modelLabel = generationModel?.trim() || 'Not recorded';

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Generation details"
          >
            <Info size={15} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-sm">
          <p className="mb-2 font-medium">Generation details</p>
          <p className="text-sm">
            <span className="text-muted-foreground">Time spent: </span>
            {generationTime}
          </p>
          <p className="mt-1 text-sm">
            <span className="text-muted-foreground">Model: </span>
            {modelLabel}
          </p>
          <div className="mt-2">
            <p className="text-sm text-muted-foreground">Rules used</p>
            {hasRules ? (
              <ul className="mt-1 space-y-0.5 text-sm">
                {ruleNames.map((name) => (
                  <li key={name}>{name}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">No rules were recorded.</p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
