import React, { useMemo } from 'react';
import {
  ArtifactSummaryType,
  IBulkDeleteArtifactItem,
} from '@shared-types';
import { BulkSelectionToolbar } from '../../../components/BulkSelectionToolbar';
import { BulkActionConfirmDialog } from '../../../components/BulkActionConfirmDialog';
import { BulkActionResultDialog } from '../../../components/BulkActionResultDialog';
import { useBulkSelection } from '../../../hooks/useBulkSelection';
import { useBulkActionFlow } from '../../../hooks/useBulkActionFlow';
import { useBulkDeleteArtifactsMutation } from '../../../store/api/Artifacts/artifactsApi';

export interface IBulkArtifactSelection {
  selectedIds: string[];
  isSelected: (id: string) => boolean;
  toggle: (id: string) => void;
  toolbar: React.ReactNode;
  dialogs: React.ReactNode;
}

interface IUseBulkArtifactPanelOptions {
  artifacts: Array<{ id: string; title: string }>;
  artifactType: ArtifactSummaryType;
  entityLabel: string;
}

/**
 * Shared bulk-delete wiring for directory detail artifact panels.
 */
export function useBulkArtifactPanel({
  artifacts,
  artifactType,
  entityLabel,
}: IUseBulkArtifactPanelOptions): IBulkArtifactSelection {
  const visibleIds = useMemo(() => artifacts.map((a) => a.id), [artifacts]);
  const labelsById = useMemo(
    () => Object.fromEntries(artifacts.map((a) => [a.id, a.title])),
    [artifacts],
  );
  const selection = useBulkSelection({ visibleIds });
  const flow = useBulkActionFlow();
  const [bulkDeleteArtifacts, { isLoading }] = useBulkDeleteArtifactsMutation();

  const toolbar = (
    <BulkSelectionToolbar
      selectedCount={selection.selectedCount}
      allVisibleSelected={selection.allVisibleSelected}
      onSelectAllVisible={selection.selectAllVisible}
      onClear={selection.clear}
      actionLabel={`Delete selected (${selection.selectedCount})`}
      onAction={flow.openConfirm}
    />
  );

  const dialogs = (
    <>
      <BulkActionConfirmDialog
        open={flow.confirmOpen}
        onOpenChange={(open) => !open && flow.closeConfirm()}
        title={`Delete ${selection.selectedCount} ${entityLabel}?`}
        description={
          <p>
            This permanently deletes the selected {entityLabel} and cannot be undone.
          </p>
        }
        confirmLabel={`Delete ${selection.selectedCount}`}
        mode="destructive"
        isLoading={isLoading}
        error={flow.error}
        onConfirm={async () => {
          const payload: IBulkDeleteArtifactItem[] = selection.selectedIds.map((id) => ({
            id,
            type: artifactType,
          }));
          await flow.runBulkAction(
            () => bulkDeleteArtifacts({ artifacts: payload }).unwrap(),
            selection,
          );
        }}
      />
      <BulkActionResultDialog
        open={flow.resultOpen}
        onOpenChange={(open) => !open && flow.closeResult()}
        title={`${entityLabel} delete results`}
        succeeded={flow.result?.succeeded ?? 0}
        failed={flow.result?.failed ?? 0}
        results={flow.result?.results ?? []}
        labelsById={labelsById}
      />
    </>
  );

  return {
    selectedIds: selection.selectedIds,
    isSelected: selection.isSelected,
    toggle: selection.toggle,
    toolbar,
    dialogs,
  };
}
