import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FileText, Trash2, ChevronDown, Brain, Layers, Presentation, Network, ListOrdered, MoreVertical, FolderInput, Loader2, AlertCircle } from 'lucide-react';
import { DocumentEnhanced } from '@shared-types';
import { formatDate } from '../../utils/dateUtils';
import { Button } from '../../components/ui/Button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../components/ui/DropdownMenu';
import { Badge } from '../../components/ui/Badge';

interface SourceRowProps {
  document: DocumentEnhanced;
  directoryId: string;
  onDelete: (document: DocumentEnhanced) => void;
  onMove: (document: DocumentEnhanced) => void;
}

export const SourceRow: React.FC<SourceRowProps> = ({ document, directoryId, onDelete, onMove }) => {
  const navigate = useNavigate();
  const isPending = document.generationStatus === 'pending';
  const isFailed = document.generationStatus === 'failed';

  if (isPending) {
    return (
      <div className="rounded-lg border border-border bg-muted/30 opacity-70 p-3 flex items-center gap-3">
        <Loader2 size={18} className="shrink-0 text-muted-foreground animate-spin" />
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate text-muted-foreground">{document.title}</div>
          <Badge variant="secondary" className="mt-1 text-xs">Preparing</Badge>
        </div>
      </div>
    );
  }

  if (isFailed) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 flex items-center gap-3">
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
    );
  }

  return (
    <div className="group rounded-lg border border-border p-3 hover:bg-muted/50 transition-colors flex items-center gap-3">
      <FileText size={18} className="shrink-0 text-muted-foreground" />

      <div className="flex-1 min-w-0">
        <Link
          to={`/document/${document.id}`}
          className="font-medium truncate hover:text-primary transition-colors"
        >
          {document.title}
        </Link>
        <div className="text-xs text-muted-foreground">
          {document.wordCount} words · {formatDate(document.createdAt)}
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
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
  );
};
