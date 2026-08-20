"use client";

import React, { useEffect, useState } from "react";
import { getSignedReadUrl } from "@/utils/storage/signedReadCache";

export interface StorageImageProps
  extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src"> {
  bucket: string;
  path: string;
  width?: number;
  height?: number;
  format?: "origin";
  /** Rendered while the signed URL is being resolved. */
  placeholder?: React.ReactNode;
}

/**
 * Renders a private Storage object by resolving a signed URL (cached).
 * For public buckets the server returns the public URL transparently.
 */
export function StorageImage({
  bucket,
  path,
  width,
  height,
  format,
  placeholder = null,
  alt = "",
  ...rest
}: StorageImageProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setUrl(null);
    setError(false);
    getSignedReadUrl(bucket, path, { width, height, format })
      .then((u) => {
        if (!cancelled) setUrl(u);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [bucket, path, width, height, format]);

  if (error) return placeholder as React.ReactElement | null;
  if (!url) return placeholder as React.ReactElement | null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={alt} {...rest} />;
}
