/** User-facing message for Next.js server action invocation failures. */
export function getServerActionErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("Failed to find Server Action")) {
    return "This page is out of date after a recent update. Please refresh the page and try again.";
  }
  if (
    message.includes("Server Components render") ||
    message.includes("digest property")
  ) {
    return "Something went wrong while saving. Please refresh the page and try again.";
  }
  if (message.includes("updated by another user")) {
    return "This design was updated elsewhere. Please refresh the page and try again.";
  }
  return message || "Something went wrong.";
}
