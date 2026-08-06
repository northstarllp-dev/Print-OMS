/**
 * Concurrency-capped async queue with per-item progress.
 * Prevents unbounded Promise.all when many files are selected.
 */

export interface QueueItemResult<T> {
  index: number;
  ok: boolean;
  value?: T;
  error?: unknown;
}

export interface QueueProgress {
  completed: number;
  failed: number;
  total: number;
}

export async function runQueue<I, O>(
  items: I[],
  worker: (item: I, index: number) => Promise<O>,
  options?: {
    concurrency?: number; // default 3
    onProgress?: (progress: QueueProgress) => void;
    signal?: AbortSignal;
  }
): Promise<QueueItemResult<O>[]> {
  const concurrency = Math.max(1, options?.concurrency ?? 3);
  const results: QueueItemResult<O>[] = new Array(items.length);
  let cursor = 0;
  let completed = 0;
  let failed = 0;

  const report = () =>
    options?.onProgress?.({ completed, failed, total: items.length });

  async function lane() {
    while (true) {
      if (options?.signal?.aborted) return;
      const index = cursor++;
      if (index >= items.length) return;
      try {
        const value = await worker(items[index], index);
        results[index] = { index, ok: true, value };
        completed++;
      } catch (error) {
        results[index] = { index, ok: false, error };
        failed++;
      }
      report();
    }
  }

  const lanes = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => lane()
  );
  await Promise.all(lanes);
  return results;
}

/** Chunk a File into fixed-size pieces (used by resumable/TUS-style uploads in tests). */
export function chunkBytes(totalBytes: number, chunkSize: number): number {
  if (chunkSize <= 0) return 0;
  return Math.ceil(totalBytes / chunkSize);
}

export const TUS_CHUNK_SIZE = 6 * 1024 * 1024; // Supabase requires 6MB
