import { HttpsError } from 'firebase-functions/v2/https';
import {
  BULK_OPERATION_MAX_ITEMS,
  IBulkOperationItemResult,
  IBulkOperationResponse,
} from '@shared-types';

export interface IExecuteBulkOperationOptions<TItem> {
  items: TItem[];
  getItemId: (item: TItem) => string;
  runItem: (item: TItem) => Promise<void>;
  maxItems?: number;
  /** Map thrown errors (or soft-failure messages) to a user-facing string. */
  getErrorMessage?: (error: unknown) => string;
}

function defaultErrorMessage(error: unknown): string {
  if (error instanceof HttpsError) {
    return error.message;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return 'Unknown error';
}

/**
 * Best-effort bulk runner shared by all bulk callables.
 * Validates non-empty input and max size, then runs each item independently.
 */
export async function executeBulkOperation<TItem>(
  options: IExecuteBulkOperationOptions<TItem>,
): Promise<IBulkOperationResponse> {
  const {
    items,
    getItemId,
    runItem,
    maxItems = BULK_OPERATION_MAX_ITEMS,
    getErrorMessage = defaultErrorMessage,
  } = options;

  if (!Array.isArray(items) || items.length === 0) {
    throw new HttpsError('invalid-argument', 'At least one item is required.');
  }

  if (items.length > maxItems) {
    throw new HttpsError(
      'invalid-argument',
      `At most ${maxItems} items can be processed in one request.`,
    );
  }

  const results: IBulkOperationItemResult[] = [];

  for (const item of items) {
    const id = getItemId(item);
    try {
      await runItem(item);
      results.push({ id, success: true });
    } catch (error) {
      results.push({
        id,
        success: false,
        error: getErrorMessage(error),
      });
    }
  }

  const succeeded = results.filter((r) => r.success).length;
  return {
    results,
    succeeded,
    failed: results.length - succeeded,
  };
}

/**
 * Soft-failure helper for operations that return `{ success: false }` instead of throwing.
 */
export async function runSoftResultItem(
  run: () => Promise<{ success: boolean; error?: string }>,
): Promise<void> {
  const result = await run();
  if (!result.success) {
    throw new Error(result.error || 'Operation failed');
  }
}
