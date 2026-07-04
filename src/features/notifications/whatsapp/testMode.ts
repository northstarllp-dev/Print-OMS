/** When true, all lifecycle notifications send Meta's hello_world (for API testing). */
export function isWhatsAppTestMode(): boolean {
  return process.env.WHATSAPP_TEST_MODE === "true";
}

/** Unique key per send so each stage can fire hello_world during testing. */
export function resolveWhatsAppIdempotencyKey(baseKey: string): string {
  if (isWhatsAppTestMode()) {
    return `${baseKey}:test:${Date.now()}`;
  }
  return baseKey;
}
