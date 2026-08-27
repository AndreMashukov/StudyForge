import type { IBulkOperationResponse } from '@shared-types';
import { BULK_OPERATION_MAX_ITEMS } from '@shared-types';

interface IBulkOperationOptions<T> {
  items: T[];
  getItemId: (item: T) => string;
  runItem: (item: T) => Promise<void>;
  maxItems?: number;
}

export async function executeBulkOperation<T>({
  items,
  getItemId,
  runItem,
  maxItems = BULK_OPERATION_MAX_ITEMS,
}: IBulkOperationOptions<T>): Promise<IBulkOperationResponse> {
  if (items.length > maxItems) {
    throw new Error(`Bulk operation supports at most ${maxItems} items.`);
  }

  const results: IBulkOperationResponse['results'] = [];
  let succeeded = 0;
  let failed = 0;

  for (const item of items) {
    const itemId = getItemId(item);
    try {
      await runItem(item);
      results.push({ id: itemId, success: true });
      succeeded += 1;
    } catch (error) {
      results.push({
        id: itemId,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      failed += 1;
    }
  }

  return { results, succeeded, failed };
}
