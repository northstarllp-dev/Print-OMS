/** App basePath from next.config.ts — Playwright paths must include this. */
export const APP_BASE_PATH = "/printoms";

/** Join app basePath with a route like `/admin/login`. */
export function appPath(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${APP_BASE_PATH}${p}`;
}
