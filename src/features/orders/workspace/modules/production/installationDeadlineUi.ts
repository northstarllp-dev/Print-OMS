/** Calendar-day countdown + urgency tones for installation deadline UI. */

export type InstallationDeadlineTone =
  | "unset"
  | "ok"
  | "soon"
  | "urgent"
  | "today"
  | "overdue";

export type InstallationDeadlineCountdown = {
  daysLeft: number | null;
  dateLabel: string;
  countdownLabel: string;
  tone: InstallationDeadlineTone;
  badgeClass: string;
  iconClass: string;
  labelClass: string;
  valueClass: string;
};

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function parseDeadlineDate(iso: string): Date | null {
  const raw = iso.includes("T") ? iso : `${iso.slice(0, 10)}T12:00:00`;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

const TONE_STYLES: Record<
  InstallationDeadlineTone,
  Pick<InstallationDeadlineCountdown, "badgeClass" | "iconClass" | "labelClass" | "valueClass">
> = {
  unset: {
    badgeClass: "border-slate-200 bg-white",
    iconClass: "text-slate-400",
    labelClass: "text-slate-400",
    valueClass: "text-slate-700",
  },
  ok: {
    badgeClass: "border-emerald-200 bg-emerald-50",
    iconClass: "text-emerald-600",
    labelClass: "text-emerald-700/80",
    valueClass: "text-emerald-900",
  },
  soon: {
    badgeClass: "border-amber-200 bg-amber-50",
    iconClass: "text-amber-600",
    labelClass: "text-amber-700/80",
    valueClass: "text-amber-900",
  },
  urgent: {
    badgeClass: "border-orange-300 bg-orange-50",
    iconClass: "text-orange-600",
    labelClass: "text-orange-700/80",
    valueClass: "text-orange-900",
  },
  today: {
    badgeClass: "border-rose-300 bg-rose-50",
    iconClass: "text-rose-600",
    labelClass: "text-rose-700/80",
    valueClass: "text-rose-900",
  },
  overdue: {
    badgeClass: "border-rose-400 bg-rose-100",
    iconClass: "text-rose-700",
    labelClass: "text-rose-800/80",
    valueClass: "text-rose-950",
  },
};

function toneForDaysLeft(daysLeft: number): InstallationDeadlineTone {
  if (daysLeft < 0) return "overdue";
  if (daysLeft === 0) return "today";
  if (daysLeft <= 3) return "urgent";
  if (daysLeft <= 7) return "soon";
  return "ok";
}

function countdownLabelFor(daysLeft: number): string {
  if (daysLeft < 0) {
    const n = Math.abs(daysLeft);
    return n === 1 ? "1 day overdue" : `${n} days overdue`;
  }
  if (daysLeft === 0) return "Due today";
  if (daysLeft === 1) return "1 day left";
  return `${daysLeft} days left`;
}

export function getInstallationDeadlineCountdown(
  deadlineIso: string | null | undefined,
  now: Date = new Date()
): InstallationDeadlineCountdown {
  if (!deadlineIso) {
    return {
      daysLeft: null,
      dateLabel: "",
      countdownLabel: "Not Set",
      tone: "unset",
      ...TONE_STYLES.unset,
    };
  }

  const deadline = parseDeadlineDate(deadlineIso);
  if (!deadline) {
    return {
      daysLeft: null,
      dateLabel: "",
      countdownLabel: "Not Set",
      tone: "unset",
      ...TONE_STYLES.unset,
    };
  }

  const daysLeft = Math.round(
    (startOfLocalDay(deadline).getTime() - startOfLocalDay(now).getTime()) / 86_400_000
  );
  const tone = toneForDaysLeft(daysLeft);
  const dateLabel = deadline.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return {
    daysLeft,
    dateLabel,
    countdownLabel: countdownLabelFor(daysLeft),
    tone,
    ...TONE_STYLES[tone],
  };
}
