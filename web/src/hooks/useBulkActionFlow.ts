import { useCallback, useState } from 'react';
import { IBulkOperationItemResult, IBulkOperationResponse } from '@shared-types';

function getBulkActionErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null) {
    const record = error as {
      data?: { message?: unknown };
      message?: unknown;
    };
    if (typeof record.data?.message === 'string' && record.data.message.trim()) {
      return record.data.message;
    }
    if (typeof record.message === 'string' && record.message.trim()) {
      return record.message;
    }
  }
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return 'Something went wrong. Please try again.';
}

export interface IBulkActionFlowState {
  confirmOpen: boolean;
  resultOpen: boolean;
  result: IBulkOperationResponse | null;
  /** Request-level failure while confirm stays open for retry. */
  error: string | null;
  openConfirm: () => void;
  closeConfirm: () => void;
  closeResult: () => void;
  /**
   * Runs the bulk mutation after confirm.
   * On success: closes confirm, updates selection, opens result dialog.
   * On rejection: keeps confirm open and sets `error` (does not rethrow).
   */
  runBulkAction: (
    execute: () => Promise<IBulkOperationResponse>,
    options: {
      keepOnly: (ids: string[]) => void;
      clear: () => void;
    },
  ) => Promise<void>;
}

export function useBulkActionFlow(): IBulkActionFlowState {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);
  const [result, setResult] = useState<IBulkOperationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const openConfirm = useCallback(() => {
    setError(null);
    setConfirmOpen(true);
  }, []);
  const closeConfirm = useCallback(() => {
    setConfirmOpen(false);
    setError(null);
  }, []);
  const closeResult = useCallback(() => {
    setResultOpen(false);
    setResult(null);
  }, []);

  const runBulkAction = useCallback(
    async (
      execute: () => Promise<IBulkOperationResponse>,
      options: {
        keepOnly: (ids: string[]) => void;
        clear: () => void;
      },
    ) => {
      try {
        const response = await execute();
        setError(null);
        setConfirmOpen(false);
        setResult(response);

        const failedIds = response.results
          .filter((r: IBulkOperationItemResult) => !r.success)
          .map((r) => r.id);

        if (failedIds.length > 0) {
          options.keepOnly(failedIds);
        } else {
          options.clear();
        }

        setResultOpen(true);
      } catch (err) {
        setError(getBulkActionErrorMessage(err));
      }
    },
    [],
  );

  return {
    confirmOpen,
    resultOpen,
    result,
    error,
    openConfirm,
    closeConfirm,
    closeResult,
    runBulkAction,
  };
}
