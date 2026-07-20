import React, { useMemo } from 'react';
import { DocumentEnhanced } from '@shared-types';
import { SourceRow } from './SourceRow';
import { ArtifactRowGenerating } from './ArtifactRow';
import { useOptimisticGeneratingRow } from './hooks/useOptimisticGeneratingRow';
import { BulkSelectCheckbox } from '../../components/BulkSelectCheckbox';
import { BulkSelectionToolbar } from '../../components/BulkSelectionToolbar';
import { BulkActionConfirmDialog } from '../../components/BulkActionConfirmDialog';
import { BulkActionResultDialog } from '../../components/BulkActionResultDialog';
import { useBulkSelection } from '../../hooks/useBulkSelection';
import { useBulkActionFlow } from '../../hooks/useBulkActionFlow';
import { useBulkDeleteDocumentsMutation } from '../../store/api/Documents/documentsApi';
import { cn } from '../../lib/utils';

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
  const { showOptimisticRow, optimisticTitle } = useOptimisticGeneratingRow(
    directoryId,
    'sources',
    documents,
  );

  const visibleIds = useMemo(() => documents.map((doc) => doc.id), [documents]);
  const labelsById = useMemo(
    () => Object.fromEntries(documents.map((doc) => [doc.id, doc.title])),
    [documents],
  );
  const selection = useBulkSelection({ visibleIds });
  const flow = useBulkActionFlow();
  const [bulkDeleteDocuments, { isLoading }] = useBulkDeleteDocumentsMutation();

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Sources ({documents.length})</h2>

      <BulkSelectionToolbar
        selectedCount={selection.selectedCount}
        allVisibleSelected={selection.allVisibleSelected}
        onSelectAllVisible={selection.selectAllVisible}
        onClear={selection.clear}
        actionLabel={`Delete selected (${selection.selectedCount})`}
        onAction={flow.openConfirm}
      />

      {documents.length === 0 && !showOptimisticRow ? (
        <div className="text-sm text-muted-foreground py-8 text-center">
          No documents yet. Add a URL, upload markdown, or generate from a prompt.
        </div>
      ) : (
        <div className="space-y-2">
          {showOptimisticRow && <ArtifactRowGenerating title={optimisticTitle} />}
          {documents.map((doc) => (
            <div
              key={doc.id}
              className={cn(
                'flex items-stretch gap-0',
                selection.isSelected(doc.id) && 'rounded-lg ring-2 ring-primary',
              )}
            >
              <div className="flex items-center pl-2">
                <BulkSelectCheckbox
                  checked={selection.isSelected(doc.id)}
                  onCheckedChange={() => selection.toggle(doc.id)}
                  label={`Select ${doc.title}`}
                />
              </div>
              <div className="min-w-0 flex-1">
                <SourceRow
                  document={doc}
                  directoryId={directoryId}
                  onDelete={onDeleteDocument}
                  onMove={onMoveDocument}
                  appliedRuleNames={doc.appliedRuleIds?.map((id) => ruleNamesMap?.get(id) ?? 'Unknown rule')}
                  generationModel={doc.generationModel}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <BulkActionConfirmDialog
        open={flow.confirmOpen}
        onOpenChange={(open) => !open && flow.closeConfirm()}
        title={`Delete ${selection.selectedCount} source${selection.selectedCount === 1 ? '' : 's'}?`}
        description={
          <p>This permanently deletes the selected documents and cannot be undone.</p>
        }
        confirmLabel={`Delete ${selection.selectedCount}`}
        mode="destructive"
        isLoading={isLoading}
        error={flow.error}
        onConfirm={async () => {
          await flow.runBulkAction(
            () =>
              bulkDeleteDocuments({
                documentIds: selection.selectedIds,
              }).unwrap(),
            selection,
          );
        }}
      />
      <BulkActionResultDialog
        open={flow.resultOpen}
        onOpenChange={(open) => !open && flow.closeResult()}
        title="Source delete results"
        succeeded={flow.result?.succeeded ?? 0}
        failed={flow.result?.failed ?? 0}
        results={flow.result?.results ?? []}
        labelsById={labelsById}
      />
    </div>
  );
};
