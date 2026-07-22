/** Must match `basePath` in next.config.ts. next/link prefixes automatically; fetch/absolute URLs do not. */
export const APP_BASE_PATH = "/printoms";

export function withBasePath(path: string): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `${APP_BASE_PATH}${clean}`;
}
