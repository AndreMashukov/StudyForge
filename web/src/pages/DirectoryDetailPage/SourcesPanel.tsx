import React from 'react';
import { DocumentEnhanced } from '@shared-types';
import { SourceRow } from './SourceRow';

interface ISourcesPanelProps {
  documents: DocumentEnhanced[];
  directoryId: string;
  onDeleteDocument: (document: DocumentEnhanced) => void;
  onMoveDocument: (document: DocumentEnhanced) => void;
  ruleNamesMap?: Map<string, string>;
}

export const SourcesPanel: React.FC<ISourcesPanelProps> = ({
  documents,
  directoryId,
  onDeleteDocument,
  onMoveDocument,
  ruleNamesMap,
}) => {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Sources ({documents.length})</h2>

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
              onMove={onMoveDocument}
              appliedRuleNames={doc.appliedRuleIds?.map((id) => ruleNamesMap?.get(id) ?? 'Unknown rule')}
              generationModel={doc.generationModel}
            />
          ))}
        </div>
      )}
    </div>
  );
};
