"use client";

/**
 * Backwards-compatible image renderer for stored references.
 * Accepts either a full (public or signed) URL or a "bucket/path" storage ref.
 * Private refs are resolved via the signed-read cache.
 */

import React, { useEffect, useMemo, useState } from "react";
import { getSignedReadUrl } from "@/utils/storage/signedReadCache";
import { parseStoredRef } from "@/utils/storage/storageRef";

export interface OrderImageProps
  extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src"> {
  src: string;
  width?: number;
  height?: number;
  format?: "origin";
  placeholder?: React.ReactNode;
}

export function OrderImage({
  src,
  width,
  height,
  format,
  placeholder = null,
  alt = "",
  ...rest
}: OrderImageProps) {
  const ref = useMemo(() => parseStoredRef(src), [src]);
  const [url, setUrl] = useState<string | null>(ref ? null : src);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!ref) {
      setUrl(src);
      return;
    }
    let cancelled = false;
    setUrl(null);
    setError(false);
    getSignedReadUrl(ref.bucket, ref.path, { width, height, format })
      .then((u) => {
        if (!cancelled) setUrl(u);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [ref, src, width, height, format]);

  if (error) return placeholder as React.ReactElement | null;
  if (!url) return placeholder as React.ReactElement | null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={alt} {...rest} />;
}
