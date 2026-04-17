import React from 'react';
import { Link } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { formatDate } from '../../../utils/dateUtils';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../../components/ui/Tooltip';
import type { IArtifactRow } from './IArtifactRow';

export const ArtifactRow: React.FC<IArtifactRow> = ({
  icon: Icon,
  title,
  createdAt,
  linkTo,
  onDelete,
  deleteAriaLabel,
  appliedRuleNames,
}) => {
  const hasRules = appliedRuleNames && appliedRuleNames.length > 0;

  return (
    <div className="group flex items-center gap-2 rounded-lg border border-border hover:bg-muted/50 transition-colors">
      <Link
        to={linkTo}
        className="flex items-center gap-3 flex-1 min-w-0 p-3"
      >
        <Icon size={18} className="shrink-0 text-muted-foreground" />
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">{title}</div>
          <div className="text-xs text-muted-foreground">{formatDate(createdAt)}</div>
        </div>
      </Link>
      <div className="flex items-center gap-1 pr-1 shrink-0">
        {hasRules && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="cursor-default" onClick={(e) => e.preventDefault()}>
                <Badge variant="secondary" className="text-xs tabular-nums">
                  {appliedRuleNames.length}
                </Badge>
              </span>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p className="font-medium mb-1">Rules applied</p>
              <ul className="space-y-0.5">
                {appliedRuleNames.map((name) => (
                  <li key={name}>{name}</li>
                ))}
              </ul>
            </TooltipContent>
          </Tooltip>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          aria-label={deleteAriaLabel}
        >
          <Trash2 size={16} />
        </Button>
      </div>
    </div>
  );
};
