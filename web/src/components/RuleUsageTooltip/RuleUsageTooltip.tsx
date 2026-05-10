import React from 'react';
import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/Tooltip';
import { IRuleUsageTooltip } from './IRuleUsageTooltip';

export const RuleUsageTooltip: React.FC<IRuleUsageTooltip> = ({
  ruleNames,
  label = 'Rules used',
}) => {
  const hasRules = ruleNames.length > 0;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={label}
          >
            <Info size={15} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-sm">
          <p className="mb-1 font-medium">{label}</p>
          {hasRules ? (
            <ul className="space-y-0.5">
              {ruleNames.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">No followup rules were selected.</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};