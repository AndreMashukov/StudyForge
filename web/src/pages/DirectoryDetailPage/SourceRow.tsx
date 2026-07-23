import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  FileText,
  Trash2,
  ChevronDown,
  Brain,
  Layers,
  Presentation,
  Network,
  ListOrdered,
  MoreVertical,
  FolderInput,
  Loader2,
  AlertCircle,
  Pencil,
} from 'lucide-react';
import { DocumentEnhanced } from '@shared-types';
import { formatDate } from '../../utils/dateUtils';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../components/ui/DropdownMenu';
import { Badge } from '../../components/ui/Badge';
import { BulkSelectCheckbox } from '../../components/BulkSelectCheckbox';
import { GenerationInfoTooltip } from '../../components/GenerationInfoTooltip';
import { getColorRailStyle } from '../../utils/sourceColorRail';
import { cn } from '../../lib/utils';
import { useSourceRowTitleEditor } from './hooks/useSourceRowTitleEditor';

interface SourceRowProps {
  document: DocumentEnhanced;
  directoryId: string;
  onDelete: (document: DocumentEnhanced) => void;
  onMove: (document: DocumentEnhanced) => void;
  appliedRuleNames?: string[];
  generationModel?: string;
  selected?: boolean;
  onSelectChange?: (selected: boolean) => void;
}

export const SourceRow: React.FC<SourceRowProps> = ({
  document,
  directoryId,
  onDelete,
  onMove,
  appliedRuleNames = [],
  generationModel,
  selected = false,
  onSelectChange,
}) => {
  const navigate = useNavigate();
  const {
    isEditingTitle,
    draftTitle,
    titleError,
    isSavingTitle,
    titleInputRef,
    startEditingTitle,
    handleTitleBlur,
    handleTitleKeyDown,
    handleDraftTitleChange,
  } = useSourceRowTitleEditor({
    documentId: document.id,
    documentTitle: document.title,
  });
  const isPending = document.generationStatus === 'pending';
  const isFailed = document.generationStatus === 'failed';
  const colorRailStyle = getColorRailStyle(document.color, document.id);

  const selectionControl = onSelectChange ? (
    <BulkSelectCheckbox
      checked={selected}
      onCheckedChange={onSelectChange}
      label={`Select ${document.title}`}
      className="pl-2"
    />
  ) : null;

  if (isPending) {
    return (
      <div
        className={cn(
          'rounded-lg border border-border border-l-[4px] bg-muted/30 opacity-70 flex items-center',
          selected && 'ring-2 ring-primary',
        )}
        style={colorRailStyle}
      >
        {selectionControl}
        <div className="flex flex-1 items-center gap-3 p-3 min-w-0">
          <Loader2 size={18} className="shrink-0 text-muted-foreground animate-spin" />
          <div className="flex-1 min-w-0">
            <div className="font-medium truncate text-muted-foreground">{document.title}</div>
            <Badge variant="secondary" className="mt-1 text-xs">Preparing</Badge>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
            onClick={() => onDelete(document)}
            aria-label={`Cancel ${document.title}`}
          >
            <Trash2 size={14} />
          </Button>
        </div>
      </div>
    );
  }

  if (isFailed) {
    return (
      <div
        className={cn(
          'rounded-lg border border-destructive/40 border-l-[4px] bg-destructive/5 flex items-center',
          selected && 'ring-2 ring-primary',
        )}
        style={colorRailStyle}
      >
        {selectionControl}
        <div className="flex flex-1 items-center gap-3 p-3 min-w-0">
          <AlertCircle size={18} className="shrink-0 text-destructive" />
          <div className="flex-1 min-w-0">
            <div className="font-medium truncate text-destructive">{document.title}</div>
            <div className="text-xs text-destructive/70 truncate">{document.generationError || 'Generation failed'}</div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
            onClick={() => onDelete(document)}
            aria-label={`Delete ${document.title}`}
          >
            <Trash2 size={14} />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'group rounded-lg border border-border border-l-[4px] hover:bg-muted/50 transition-colors flex items-center',
        selected && 'ring-2 ring-primary',
      )}
      style={colorRailStyle}
    >
      {selectionControl}
      <div className="flex flex-1 items-center gap-3 p-3 min-w-0">
        <FileText size={18} className="shrink-0 text-muted-foreground" />

        <div className="flex-1 min-w-0">
          {isEditingTitle ? (
            <div className="space-y-1">
              <Input
                ref={titleInputRef}
                value={draftTitle}
                onChange={(event) => handleDraftTitleChange(event.target.value)}
                onBlur={handleTitleBlur}
                onKeyDown={handleTitleKeyDown}
                disabled={isSavingTitle}
                aria-label={`Edit name for ${document.title}`}
                className={cn('h-8 font-medium', titleError && 'border-destructive')}
              />
              {titleError && <p className="text-xs text-destructive">{titleError}</p>}
            </div>
          ) : (
            <div className="flex items-center gap-1 min-w-0">
              <Link
                to={`/document/${document.id}`}
                className="font-medium truncate hover:text-primary transition-colors"
              >
                {document.title}
              </Link>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground transition-opacity"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  startEditingTitle();
                }}
                aria-label={`Edit name for ${document.title}`}
              >
                <Pencil size={13} />
              </Button>
            </div>
          )}
          <div className="text-xs text-muted-foreground">
            {document.wordCount} words · {formatDate(document.createdAt)}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <span onClick={(e) => e.stopPropagation()}>
            <GenerationInfoTooltip
              createdAt={document.createdAt}
              completedAt={document.completedAt}
              ruleNames={appliedRuleNames}
              generationModel={generationModel ?? document.generationModel}
            />
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1 px-2"
                onClick={(e) => e.stopPropagation()}
              >
                Generate
                <ChevronDown size={12} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => navigate(`/quiz/create?directoryId=${directoryId}&documentId=${document.id}`)}
              >
                <Brain size={14} className="mr-2" />
                Quiz
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => navigate(`/flashcards/create?directoryId=${directoryId}&documentId=${document.id}`)}
              >
                <Layers size={14} className="mr-2" />
                Flashcards
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => navigate(`/slides/create?directoryId=${directoryId}&documentId=${document.id}`)}
              >
                <Presentation size={14} className="mr-2" />
                Slide deck
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  navigate(`/diagram-quiz/create?directoryId=${directoryId}&documentId=${document.id}`)
                }
              >
                <Network size={14} className="mr-2" />
                Diagram quiz
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  navigate(`/sequence-quiz/create?directoryId=${directoryId}&documentId=${document.id}`)
                }
              >
                <ListOrdered size={14} className="mr-2" />
                Sequence quiz
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                onClick={(e) => e.stopPropagation()}
                aria-label={`Actions for ${document.title}`}
              >
                <MoreVertical size={14} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => onMove(document)}
              >
                <FolderInput size={14} className="mr-2" />
                Move
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => onDelete(document)}
              >
                <Trash2 size={14} className="mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
};
