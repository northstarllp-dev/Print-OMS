import { describe, expect, it } from "vitest";
import { getInstallationDeadlineCountdown } from "@/features/orders/workspace/modules/production/installationDeadlineUi";

describe("getInstallationDeadlineCountdown", () => {
  const now = new Date("2026-08-05T10:00:00");

  it("returns unset when no deadline", () => {
    const r = getInstallationDeadlineCountdown(null, now);
    expect(r.tone).toBe("unset");
    expect(r.countdownLabel).toBe("Not Set");
    expect(r.daysLeft).toBeNull();
  });

  it("colors by days remaining", () => {
    expect(getInstallationDeadlineCountdown("2026-08-20", now).tone).toBe("ok");
    expect(getInstallationDeadlineCountdown("2026-08-10", now).tone).toBe("soon");
    expect(getInstallationDeadlineCountdown("2026-08-07", now).tone).toBe("urgent");
    expect(getInstallationDeadlineCountdown("2026-08-05", now).tone).toBe("today");
    expect(getInstallationDeadlineCountdown("2026-08-05", now).countdownLabel).toBe("Due today");
    expect(getInstallationDeadlineCountdown("2026-08-02", now).tone).toBe("overdue");
    expect(getInstallationDeadlineCountdown("2026-08-02", now).countdownLabel).toBe("3 days overdue");
  });
});
