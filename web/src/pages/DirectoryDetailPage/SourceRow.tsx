import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Trash2, ChevronDown, Brain, Layers, Presentation } from 'lucide-react';
import { DocumentEnhanced } from '@shared-types';
import { formatDate } from '../../utils/dateUtils';
import { Button } from '../../components/ui/Button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../components/ui/DropdownMenu';

interface SourceRowProps {
  document: DocumentEnhanced;
  directoryId: string;
  onDelete: (document: DocumentEnhanced) => void;
}

export const SourceRow: React.FC<SourceRowProps> = ({ document, directoryId, onDelete }) => {
  const navigate = useNavigate();

  return (
    <div className="group rounded-lg border border-border p-3 hover:bg-muted/50 transition-colors flex items-center gap-3">
      <FileText size={18} className="shrink-0 text-muted-foreground" />

      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{document.title}</div>
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
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 pointer-events-none group-hover:pointer-events-auto focus-visible:pointer-events-auto transition-opacity text-muted-foreground hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(document);
          }}
          aria-label={`Delete ${document.title}`}
        >
          <Trash2 size={14} />
        </Button>
      </div>
    </div>
  );
};
