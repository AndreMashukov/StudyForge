import React from 'react';
import { Link } from 'react-router-dom';
import { DocumentEnhanced } from '@shared-types';
import { Button } from '../../components/ui/Button';
import { SourceRow } from './SourceRow';

interface SourcesPanelProps {
  documents: DocumentEnhanced[];
  directoryId: string;
  onDeleteDocument: (document: DocumentEnhanced) => void;
}

export const SourcesPanel: React.FC<SourcesPanelProps> = ({
  documents,
  directoryId,
  onDeleteDocument,
}) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Sources ({documents.length})</h2>
        <Button size="sm" asChild>
          <Link to={`/documents/create?directoryId=${directoryId}`}>+ Add source</Link>
        </Button>
      </div>

      {documents.length === 0 ? (
        <div className="text-sm text-muted-foreground py-8 text-center">
          No documents yet. Add a URL, upload markdown, or generate from a prompt.
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <SourceRow
              key={doc.id}
              document={doc}
              directoryId={directoryId}
              onDelete={onDeleteDocument}
            />
          ))}
        </div>
      )}
    </div>
  );
};
