/**
 * Run async mappers over items with a bounded worker pool.
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, itemIndex: number) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) {
    return [];
  }

  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }

  const workerCount = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  return results;
}

/**
 * Split indexes `[0..itemCount)` into batches, merging a lone remainder into the
 * previous batch when it would otherwise be undersized.
 */
export function buildIndexBatches(
  itemCount: number,
  batchSize: number,
  maxBatchSize: number
): number[][] {
  if (itemCount <= 0) {
    return [];
  }

  const batches: number[][] = [];
  let index = 0;

  while (index < itemCount) {
    const remaining = itemCount - index;
    let currentBatchSize = Math.min(batchSize, remaining);

    if (remaining === 1 && batches.length > 0) {
      const previous = batches[batches.length - 1];
      if (previous.length < maxBatchSize) {
        previous.push(index);
        break;
      }
    }

    if (remaining === 3 && currentBatchSize === batchSize && batchSize === 2) {
      currentBatchSize = maxBatchSize;
    }

    const batch: number[] = [];
    for (let offset = 0; offset < currentBatchSize; offset += 1) {
      batch.push(index + offset);
    }
    batches.push(batch);
    index += currentBatchSize;
  }

  return batches;
}
