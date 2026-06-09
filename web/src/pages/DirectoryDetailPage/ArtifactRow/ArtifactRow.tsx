import React from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Trash2, AlertCircle } from 'lucide-react';
import { formatDate } from '../../../utils/dateUtils';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { GenerationInfoTooltip } from '../../../components/GenerationInfoTooltip';
import { getColorRailStyle, getSegmentedRailColors, isMultiColor } from '../../../utils/sourceColorRail';
import type { IArtifactRow } from './IArtifactRow';

const ColorRail: React.FC<{ documentColor?: string; documentColors?: string[] }> = ({
  documentColor,
  documentColors,
}) => {
  if (isMultiColor(documentColors)) {
    const segments = getSegmentedRailColors(documentColors);
    return (
      <div className="w-[4px] self-stretch shrink-0 rounded-l-lg overflow-hidden flex flex-col">
        {segments.map((color, i) => (
          <div key={i} className="flex-1" style={{ backgroundColor: color }} />
        ))}
      </div>
    );
  }
  const style = getColorRailStyle(documentColor);
  return <div className="w-[4px] self-stretch shrink-0 rounded-l-lg" style={{ backgroundColor: style.borderLeftColor as string }} />;
};

export const ArtifactRow: React.FC<IArtifactRow> = ({
  icon: Icon,
  title,
  createdAt,
  linkTo,
  onDelete,
  deleteAriaLabel,
  appliedRuleNames,
  completedAt,
  generationModel,
  generationStatus,
  generationError,
  documentColor,
  documentColors,
}) => {
  const isPending = generationStatus === 'pending';
  const isFailed = generationStatus === 'failed';
  if (isPending) {
    return (
      <div className="flex items-center rounded-lg border border-border bg-muted/30 opacity-70 overflow-hidden">
        <ColorRail documentColor={documentColor} documentColors={documentColors} />
        <div className="flex items-center gap-2 flex-1 min-w-0 p-3">
          <Loader2 size={18} className="shrink-0 text-muted-foreground animate-spin" />
          <div className="flex-1 min-w-0">
            <div className="font-medium truncate text-muted-foreground">{title}</div>
            <Badge variant="secondary" className="mt-1 text-xs">Preparing</Badge>
          </div>
        </div>
      </div>
    );
  }

  if (isFailed) {
    return (
      <div className="flex items-center rounded-lg border border-destructive/40 bg-destructive/5 overflow-hidden">
        <ColorRail documentColor={documentColor} documentColors={documentColors} />
        <div className="flex items-center gap-2 flex-1 min-w-0 p-3">
          <AlertCircle size={18} className="shrink-0 text-destructive" />
          <div className="flex-1 min-w-0">
            <div className="font-medium truncate text-destructive">{title}</div>
            <div className="text-xs text-destructive/70 truncate">{generationError || 'Generation failed'}</div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring"
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
  }

  return (
    <div className="group flex items-center rounded-lg border border-border hover:bg-muted/50 transition-colors overflow-hidden">
      <ColorRail documentColor={documentColor} documentColors={documentColors} />
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
        <span onClick={(e) => e.preventDefault()}>
          <GenerationInfoTooltip
            createdAt={createdAt}
            completedAt={completedAt}
            ruleNames={appliedRuleNames ?? []}
            generationModel={generationModel}
          />
        </span>
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
