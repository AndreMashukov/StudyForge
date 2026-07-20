import React, { useMemo } from 'react';
import { Rule } from '@shared-types';
import { BulkSelectionToolbar } from '../../../../components/BulkSelectionToolbar';
import { BulkActionConfirmDialog } from '../../../../components/BulkActionConfirmDialog';
import { BulkActionResultDialog } from '../../../../components/BulkActionResultDialog';
import { useBulkSelection } from '../../../../hooks/useBulkSelection';
import { useBulkActionFlow } from '../../../../hooks/useBulkActionFlow';
import { useBulkDetachRulesFromDirectoryMutation } from '../../../../store/api/Rules/rulesApi';

export interface IBulkDetachDirectoryRules {
  isSelected: (id: string) => boolean;
  toggle: (id: string) => void;
  toolbar: React.ReactNode;
  dialogs: React.ReactNode;
}

interface IUseBulkDetachDirectoryRulesOptions {
  directoryId: string;
  directRules: Rule[];
}

/**
 * Bulk unassign wiring for directory-assigned rules (direct rules only).
 */
export function useBulkDetachDirectoryRules({
  directoryId,
  directRules,
}: IUseBulkDetachDirectoryRulesOptions): IBulkDetachDirectoryRules {
  const visibleIds = useMemo(
    () => directRules.map((rule) => rule.id),
    [directRules],
  );
  const labelsById = useMemo(
    () => Object.fromEntries(directRules.map((rule) => [rule.id, rule.name])),
    [directRules],
  );
  const selection = useBulkSelection({ visibleIds });
  const flow = useBulkActionFlow();
  const [bulkDetachRules, { isLoading }] = useBulkDetachRulesFromDirectoryMutation();

  const toolbar = (
    <BulkSelectionToolbar
      selectedCount={selection.selectedCount}
      allVisibleSelected={selection.allVisibleSelected}
      onSelectAllVisible={selection.selectAllVisible}
      onClear={selection.clear}
      actionLabel={`Unassign selected (${selection.selectedCount})`}
      onAction={flow.openConfirm}
      actionVariant="default"
    />
  );

  const dialogs = (
    <>
      <BulkActionConfirmDialog
        open={flow.confirmOpen}
        onOpenChange={(open) => !open && flow.closeConfirm()}
        title={`Unassign ${selection.selectedCount} rule${selection.selectedCount === 1 ? '' : 's'}?`}
        description={
          <p>
            Selected rules will be removed from this directory. The rules themselves
            will not be deleted.
          </p>
        }
        confirmLabel={`Unassign ${selection.selectedCount} rule${selection.selectedCount === 1 ? '' : 's'}`}
        mode="simple"
        isLoading={isLoading}
        error={flow.error}
        onConfirm={async () => {
          if (!directoryId) {
            return;
          }
          await flow.runBulkAction(
            () =>
              bulkDetachRules({
                directoryId,
                ruleIds: selection.selectedIds,
              }).unwrap(),
            selection,
          );
        }}
      />
      <BulkActionResultDialog
        open={flow.resultOpen}
        onOpenChange={(open) => !open && flow.closeResult()}
        title="Unassign results"
        succeeded={flow.result?.succeeded ?? 0}
        failed={flow.result?.failed ?? 0}
        results={flow.result?.results ?? []}
        labelsById={labelsById}
      />
    </>
  );

  return {
    isSelected: selection.isSelected,
    toggle: selection.toggle,
    toolbar,
    dialogs,
  };
}
