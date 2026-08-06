"use client";

import { useCallback, useRef, useState } from "react";
import type { StorageUploadPurpose } from "@/utils/supabase/serverStorageUpload";
import {
  uploadFiles,
  type PerFileProgress,
  type UploadOutcome,
} from "@/utils/storage/uploadClient";
import type { QueueProgress } from "@/utils/storage/uploadQueue";

export interface UseOrderUploadOptions {
  orderId: string;
  purpose: StorageUploadPurpose;
  channel: "staff" | "portal";
  portalToken?: string;
  concurrency?: number;
  compress?: boolean;
}

export interface OrderUploadState {
  uploading: boolean;
  queue: QueueProgress | null;
  files: PerFileProgress[];
  /** Overall 0–100 across the batch. */
  percent: number;
}

/**
 * Shared upload state for order-stage uploads.
 * Returns a `start(files)` that uploads via the direct signed pipeline
 * and a legacy-compatible `uploadOne(file)` that returns a stored ref.
 */
export function useOrderUpload(opts: UseOrderUploadOptions) {
  const [state, setState] = useState<OrderUploadState>({
    uploading: false,
    queue: null,
    files: [],
    percent: 0,
  });
  const abortRef = useRef<AbortController | null>(null);

  const start = useCallback(
    async (files: File[]): Promise<{ ok: UploadOutcome[]; failed: { index: number; fileName: string; error: string }[] }> => {
      const controller = new AbortController();
      abortRef.current = controller;
      setState({ uploading: true, queue: null, files: [], percent: 0 });

      const result = await uploadFiles(files, {
        orderId: opts.orderId,
        purpose: opts.purpose,
        channel: opts.channel,
        portalToken: opts.portalToken,
        concurrency: opts.concurrency ?? 3,
        compress: opts.compress,
        signal: controller.signal,
        onFileProgress: (p) =>
          setState((s) => {
            const files = [...s.files];
            files[p.index] = p;
            const totals = files.reduce(
              (acc, f) => {
                acc.loaded += f?.loaded ?? 0;
                acc.total += f?.total ?? 0;
                return acc;
              },
              { loaded: 0, total: 0 }
            );
            return {
              ...s,
              files,
              percent:
                totals.total > 0
                  ? Math.round((totals.loaded / totals.total) * 100)
                  : s.percent,
            };
          }),
        onQueueProgress: (queue) => setState((s) => ({ ...s, queue })),
      });

      setState((s) => ({ ...s, uploading: false, percent: 100 }));
      return result;
    },
    [opts.orderId, opts.purpose, opts.channel, opts.portalToken, opts.concurrency, opts.compress]
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setState((s) => ({ ...s, uploading: false }));
  }, []);

  /** Upload a single file; returns a "bucket/path" stored ref (not a public URL). */
  const uploadOne = useCallback(
    async (file: File | Blob, fileName?: string): Promise<{ ref: string; bucket: string; path: string; name: string }> => {
      const asFile =
        file instanceof File && file.name
          ? file
          : new File([file], fileName || "upload.jpg", { type: file.type || "image/jpeg" });
      const { ok, failed } = await start([asFile]);
      if (!ok.length) {
        throw new Error(failed[0]?.error || "Upload failed");
      }
      const out = ok[0];
      return { ref: `${out.bucket}/${out.path}`, bucket: out.bucket, path: out.path, name: out.fileName };
    },
    [start]
  );

  return { ...state, start, cancel, uploadOne };
}
