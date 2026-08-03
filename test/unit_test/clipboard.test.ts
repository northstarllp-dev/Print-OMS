// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { copyTextToClipboard } from "@/lib/clipboard";

describe("copyTextToClipboard", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      writable: true,
      value: vi.fn().mockReturnValue(true),
    });
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("uses Clipboard API when available in a secure context", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    Object.defineProperty(window, "isSecureContext", {
      configurable: true,
      value: true,
    });

    await copyTextToClipboard("https://example.com/portal");

    expect(writeText).toHaveBeenCalledWith("https://example.com/portal");
  });

  it("falls back to execCommand when Clipboard API rejects", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: vi.fn().mockRejectedValue(new Error("NotAllowedError")),
      },
    });
    Object.defineProperty(window, "isSecureContext", {
      configurable: true,
      value: true,
    });
    const exec = document.execCommand as ReturnType<typeof vi.fn>;
    exec.mockReturnValue(true);

    await expect(copyTextToClipboard("portal-url")).resolves.toBeUndefined();
    expect(exec).toHaveBeenCalledWith("copy");
  });

  it("throws when both clipboard methods fail", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: vi.fn().mockRejectedValue(new Error("denied")),
      },
    });
    Object.defineProperty(window, "isSecureContext", {
      configurable: true,
      value: true,
    });
    (document.execCommand as ReturnType<typeof vi.fn>).mockReturnValue(false);

    await expect(copyTextToClipboard("x")).rejects.toThrow(
      "Unable to copy to clipboard"
    );
  });
});
