import React from 'react';
import { Loader2 } from 'lucide-react';
import { Badge } from '../../../components/ui/Badge';

interface ArtifactRowGeneratingProps {
  title?: string;
}

export const ArtifactRowGenerating: React.FC<ArtifactRowGeneratingProps> = ({
  title = 'Preparing...',
}) => {
  return (
    <div className="flex items-center rounded-lg border border-border bg-muted/30 opacity-70 overflow-hidden">
      <div className="flex items-center gap-2 flex-1 min-w-0 p-3">
        <Loader2 size={18} className="shrink-0 text-muted-foreground animate-spin" />
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate text-muted-foreground">{title}</div>
          <Badge variant="secondary" className="mt-1 text-xs">Preparing</Badge>
        </div>
      </div>
    </div>
  );
};
