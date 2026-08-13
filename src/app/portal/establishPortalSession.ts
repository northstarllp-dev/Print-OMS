import { withBasePath } from "@/lib/appBasePath";

const established = new Set<string>();

/** Set the HttpOnly portal cookie once per token. Repeat POSTs can retrigger RSC refresh. */
export function establishPortalSession(token: string): void {
  if (!token || established.has(token)) return;
  established.add(token);
  void fetch(withBasePath("/api/portal/session"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  }).catch(() => {
    established.delete(token);
  });
}
