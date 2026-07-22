const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
  gif: "image/gif",
};

function guessContentType(file: File): string {
  if (file.type) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  return MIME_BY_EXT[ext] || "image/jpeg";
}

/** Read a browser File as ArrayBuffer — required for reliable mobile uploads to Supabase Storage. */
export async function readFileForStorageUpload(file: File): Promise<{
  body: ArrayBuffer;
  contentType: string;
  ext: string;
}> {
  if (!file || file.size === 0) {
    throw new Error("Selected file is empty. Please choose another photo.");
  }

  const body = await file.arrayBuffer();
  if (!body.byteLength) {
    throw new Error("Could not read photo data. Please try again.");
  }

  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  return {
    body,
    contentType: guessContentType(file),
    ext,
  };
}
