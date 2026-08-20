import { describe, expect, it, vi } from "vitest";
import { runQueue, type QueueProgress } from "@/utils/storage/uploadQueue";

describe("runQueue (concurrency cap + progress)", () => {
  it("caps concurrency and preserves result order", async () => {
    let active = 0;
    let maxActive = 0;
    const items = Array.from({ length: 10 }, (_, i) => i);

    const results = await runQueue(
      items,
      async (i) => {
        active++;
        maxActive = Math.max(maxActive, active);
        await new Promise((r) => setTimeout(r, 5));
        active--;
        return i * 2;
      },
      { concurrency: 3 }
    );

    expect(maxActive).toBeLessThanOrEqual(3);
    expect(results.map((r) => r.value)).toEqual(items.map((i) => i * 2));
    expect(results.every((r) => r.ok)).toBe(true);
  });

  it("collects per-item failures without aborting the batch", async () => {
    const results = await runQueue(
      [1, 2, 3, 4],
      async (i) => {
        if (i === 2 || i === 4) throw new Error(`fail-${i}`);
        return i;
      },
      { concurrency: 2 }
    );

    expect(results.filter((r) => r.ok)).toHaveLength(2);
    expect(results.filter((r) => !r.ok)).toHaveLength(2);
    expect(results[1].error).toBeInstanceOf(Error);
  });

  it("reports progress after each item", async () => {
    const progress: QueueProgress[] = [];
    await runQueue([1, 2, 3], async (i) => i, {
      concurrency: 2,
      onProgress: (p) => progress.push(p),
    });
    expect(progress).toHaveLength(3);
    expect(progress[progress.length - 1]).toEqual({ completed: 3, failed: 0, total: 3 });
  });

  it("stops starting new items when aborted", async () => {
    const controller = new AbortController();
    const worker = vi.fn(async (i: number) => {
      if (i === 0) controller.abort();
      return i;
    });
    await runQueue([0, 1, 2, 3, 4], worker, { concurrency: 1, signal: controller.signal });
    expect(worker.mock.calls.length).toBeLessThanOrEqual(1);
  });
});
