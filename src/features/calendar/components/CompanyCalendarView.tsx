"use client";

import React, { useCallback, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Phone,
  User,
  Filter,
  RefreshCw,
  ExternalLink,
  CalendarClock,
  AlertCircle,
  Eye,
} from "lucide-react";
import {
  buildCalendarEvents,
  eventStatus,
  todayDateKey,
} from "@/features/calendar/buildCalendarEvents";
import type {
  CalendarCustomerInput,
  CalendarEmployeeInput,
  CalendarEvent,
  CalendarTaskInput,
  CalendarEventType,
  CalendarOrderInput,
  PaymentOutstandingMap,
} from "@/features/calendar/types";
import { getTaskById } from "@/features/tasks/actions/taskActions";
import type { TaskRecord } from "@/features/tasks/types";
import { TaskDetailPanel } from "@/features/tasks/components/TaskDetailPanel";

const TYPE_META: Record<
  CalendarEventType,
  { label: string; short: string; badge: string; dot: string }
> = {
  site_visit: {
    label: "Site Visit",
    short: "Visit",
    badge: "bg-indigo-50 text-indigo-700 border-indigo-200",
    dot: "bg-indigo-600",
  },
  installation: {
    label: "Installation",
    short: "Install",
    badge: "bg-cyan-50 text-cyan-700 border-cyan-200",
    dot: "bg-cyan-600",
  },
  deadline: {
    label: "Production Deadline",
    short: "Deadline",
    badge: "bg-amber-50 text-amber-800 border-amber-200",
    dot: "bg-amber-500",
  },
  task: {
    label: "Task",
    short: "Task",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dot: "bg-emerald-600",
  },
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type ViewMode = "month" | "week" | "today";

interface CompanyCalendarViewProps {
  orders: CalendarOrderInput[];
  customers?: CalendarCustomerInput[];
  employees?: CalendarEmployeeInput[];
  paymentMap?: PaymentOutstandingMap;
  tasks?: CalendarTaskInput[];
  title?: string;
  subtitle?: string;
  orderDetailBasePath: string;
  taskDetailBasePath?: string;
  lockedEmployeeId?: string;
  showEmployeeFilter?: boolean;
  isAdmin?: boolean;
  /** Server actions for rescheduling */
  onRescheduleSiteVisit?: (orderId: string, data: { auditDate: string; preferredDate: string; preferredTime?: string; customerAddress?: string }) => Promise<any>;
  onRescheduleInstallation?: (orderId: string, data: { scheduledDate: string; scheduledTime: string }) => Promise<any>;
}

function monthLabel(year: number, month: number) {
  return new Date(year, month, 1).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
}

function formatDisplayDate(dateKey: string) {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function toKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function buildMonthCells(year: number, month: number) {
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: { day: number; inMonth: boolean; dateKey: string }[] = [];

  for (let i = 0; i < firstDow; i++) {
    const d = new Date(year, month, 1 - (firstDow - i));
    cells.push({ day: d.getDate(), inMonth: false, dateKey: toKey(d) });
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month, day);
    cells.push({ day, inMonth: true, dateKey: toKey(d) });
  }

  let next = 1;
  while (cells.length % 7 !== 0) {
    const d = new Date(year, month + 1, next++);
    cells.push({ day: d.getDate(), inMonth: false, dateKey: toKey(d) });
  }

  return cells;
}

function getWeekRange(dateKey: string): string[] {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const dow = date.getDay();
  const monday = new Date(date);
  monday.setDate(date.getDate() - ((dow + 6) % 7));
  const days: string[] = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    days.push(toKey(day));
  }
  return days;
}

function weekLabel(weekDays: string[]) {
  const first = weekDays[0];
  const last = weekDays[6];
  return `${formatDisplayDate(first)} – ${formatDisplayDate(last)}`;
}

function formatCurrency(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`;
}

export function CompanyCalendarView({
  orders,
  customers = [],
  employees = [],
  paymentMap,
  tasks = [],
  title = "Company Calendar",
  subtitle = "Site visits, installations, and production deadlines across the team.",
  orderDetailBasePath,
  taskDetailBasePath,
  lockedEmployeeId,
  showEmployeeFilter = true,
  isAdmin = false,
  onRescheduleSiteVisit,
  onRescheduleInstallation,
}: CompanyCalendarViewProps) {
  const today = todayDateKey();
  const initial = new Date();
  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth());
  const [selectedDate, setSelectedDate] = useState(today);
  const [viewMode, setViewMode] = useState<ViewMode>("month");

  const [typeFilter, setTypeFilter] = useState<"all" | CalendarEventType>("all");
  const [employeeFilter, setEmployeeFilter] = useState(lockedEmployeeId || "all");
  const [upcomingOnly, setUpcomingOnly] = useState(false);
  const [showDeadlines, setShowDeadlines] = useState(true);

  // Reschedule modal state
  const [rescheduleEvent, setRescheduleEvent] = useState<CalendarEvent | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [isPending, startTransition] = useTransition();
  const [rescheduleError, setRescheduleError] = useState("");
  const [selectedTask, setSelectedTask] = useState<TaskRecord | null>(null);
  const [taskLoadingId, setTaskLoadingId] = useState<string | null>(null);

  const resetFilters = () => {
    setTypeFilter("all");
    if (!lockedEmployeeId) setEmployeeFilter("all");
    setUpcomingOnly(false);
    setShowDeadlines(true);
  };

  const employeeNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of employees) map.set(e.id, e.name);
    return map;
  }, [employees]);

  const allEvents = useMemo(
    () => buildCalendarEvents(orders, customers, paymentMap, tasks),
    [orders, customers, paymentMap, tasks]
  );

  const filteredEvents = useMemo(() => {
    return allEvents.filter((event) => {
      if (!showDeadlines && event.type === "deadline") return false;
      if (typeFilter !== "all" && event.type !== typeFilter) return false;

      const empId = lockedEmployeeId || (employeeFilter !== "all" ? employeeFilter : null);
      if (empId && !event.assigneeIds.includes(empId)) return false;

      if (upcomingOnly) {
        const status = eventStatus(event, today);
        if (status === "done" || status === "overdue") return false;
      }

      return true;
    });
  }, [
    allEvents,
    typeFilter,
    employeeFilter,
    lockedEmployeeId,
    upcomingOnly,
    showDeadlines,
    today,
  ]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of filteredEvents) {
      const list = map.get(event.dateKey) || [];
      list.push(event);
      map.set(event.dateKey, list);
    }
    return map;
  }, [filteredEvents]);

  const cells = useMemo(
    () => buildMonthCells(viewYear, viewMonth),
    [viewYear, viewMonth]
  );

  const selectedEvents = eventsByDate.get(selectedDate) || [];

  // Week view data
  const weekDays = useMemo(() => getWeekRange(selectedDate), [selectedDate]);

  // Today strip: today + next 7 days
  const todayStripDays = useMemo(() => {
    const days: string[] = [];
    const t = new Date();
    for (let i = 0; i < 8; i++) {
      const d = new Date(t);
      d.setDate(t.getDate() + i);
      days.push(toKey(d));
    }
    return days;
  }, []);

  const overdueCount = useMemo(() => {
    return filteredEvents.filter((e) => eventStatus(e, today) === "overdue").length;
  }, [filteredEvents, today]);

  const shiftMonth = (delta: number) => {
    const d = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  };

  const shiftWeek = (delta: number) => {
    const [y, m, d] = selectedDate.split("-").map(Number);
    const date = new Date(y, m - 1, d + delta * 7);
    setSelectedDate(toKey(date));
    setViewYear(date.getFullYear());
    setViewMonth(date.getMonth());
  };

  const jumpToToday = () => {
    const now = new Date();
    setSelectedDate(today);
    setViewYear(now.getFullYear());
    setViewMonth(now.getMonth());
  };

  const resolveAssignees = (ids: string[]) =>
    ids
      .map((id) => employeeNameById.get(id) || id)
      .filter(Boolean)
      .slice(0, 3);

  const openReschedule = (event: CalendarEvent) => {
    setRescheduleEvent(event);
    setRescheduleDate(event.dateKey);
    setRescheduleTime(event.time || "");
    setRescheduleError("");
  };

  const handleReschedule = () => {
    if (!rescheduleEvent || !rescheduleDate) return;
    const orderId = rescheduleEvent.orderId;
    if (!orderId) return;
    setRescheduleError("");
    startTransition(async () => {
      try {
        if (rescheduleEvent.type === "site_visit" && onRescheduleSiteVisit) {
          await onRescheduleSiteVisit(orderId, {
            auditDate: rescheduleDate,
            preferredDate: rescheduleDate,
            preferredTime: rescheduleTime || undefined,
            customerAddress: rescheduleEvent.address || undefined,
          });
        } else if (rescheduleEvent.type === "installation" && onRescheduleInstallation) {
          await onRescheduleInstallation(orderId, {
            scheduledDate: rescheduleDate,
            scheduledTime: rescheduleTime || "10:00",
          });
        }
        setRescheduleEvent(null);
      } catch (err: any) {
        setRescheduleError(err?.message || "Failed to reschedule");
      }
    });
  };

  const canReschedule = (event: CalendarEvent) =>
    event.type === "site_visit" || event.type === "installation";

  const openTaskDetail = useCallback(async (taskId?: string) => {
    if (!taskId) return;
    setTaskLoadingId(taskId);
    try {
      const task = await getTaskById(taskId);
      if (task) setSelectedTask(task);
    } finally {
      setTaskLoadingId(null);
    }
  }, []);

  // Shared event card renderer
  const renderEventCard = useCallback(
    (item: CalendarEvent, showDate = false) => {
      const meta = TYPE_META[item.type];
      const status = eventStatus(item, today);
      const assignees = resolveAssignees(item.assigneeIds);
      const href =
        item.type === "task"
          ? taskDetailBasePath || "#"
          : `${orderDetailBasePath}/${item.orderCode || item.orderId}`;
      const isOverdue = status === "overdue";
      const isTaskLoading = item.taskId != null && taskLoadingId === item.taskId;

      return (
        <div
          key={item.id}
          className={`p-3.5 sm:p-4 bg-white border rounded-[var(--radius-xl)] space-y-2.5 ${
            isOverdue
              ? "border-l-[3px] border-l-red-400 border-t-[var(--border)] border-r-[var(--border)] border-b-[var(--border)] bg-red-50/30"
              : "border-[var(--border)]"
          }`}
        >
          <div className="flex justify-between items-start gap-2">
            <span
              className={`prt-badge border uppercase text-[9px] ${meta.badge}`}
            >
              {meta.label}
            </span>
            <div className="flex items-center gap-1.5">
              {(item.outstandingAmount ?? 0) > 0 && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                  {formatCurrency(item.outstandingAmount!)} due
                </span>
              )}
              {isOverdue && (
                <span className="text-[9px] font-bold uppercase text-red-600">
                  Overdue
                </span>
              )}
              {status === "today" && (
                <span className="text-[9px] font-bold uppercase text-blue-600">
                  Today
                </span>
              )}
              {status === "done" && (
                <span className="text-[9px] font-bold uppercase text-emerald-600">
                  Done
                </span>
              )}
            </div>
          </div>

          <div>
            {item.type === "task" ? (
              <button
                type="button"
                onClick={() => void openTaskDetail(item.taskId)}
                className="font-bold text-slate-800 text-sm hover:text-[var(--color-primary,#1E40AF)] transition-colors text-left cursor-pointer"
              >
                {item.projectName}
              </button>
            ) : (
              <Link
                href={href}
                className="font-bold text-slate-800 text-sm hover:text-[var(--color-primary,#1E40AF)] transition-colors"
              >
                {item.projectName}
              </Link>
            )}
            <span className="text-[10px] font-semibold text-slate-400 block mt-0.5">
              {item.clientName}
              {item.orderCode ? ` · ${item.orderCode}` : ""}
              {item.metaLabel ? ` · ${item.metaLabel}` : ""}
            </span>
          </div>

          <div className="space-y-1.5 pt-2 border-t border-slate-50 text-xs text-slate-600 font-medium">
            {(showDate || item.time || item.dateKey) && (
              <div className="flex items-center">
                <Clock size={12} className="mr-2 text-slate-400 shrink-0" />
                <span>
                  {showDate ? formatDisplayDate(item.dateKey) : ""}
                  {showDate && item.time ? " at " : ""}
                  {!showDate && item.time ? `${formatDisplayDate(item.dateKey)} at ` : ""}
                  {item.time || (!showDate ? formatDisplayDate(item.dateKey) : "")}
                </span>
              </div>
            )}
            {item.address && (
              <div className="flex items-start">
                <MapPin size={12} className="mr-2 mt-0.5 text-slate-400 shrink-0" />
                <span className="line-clamp-2">{item.address}</span>
                {(item.gmapLink || item.address) && (
                  <a
                    href={item.gmapLink || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.address)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-1.5 text-blue-500 hover:text-blue-700 shrink-0"
                    title="Open in Google Maps"
                  >
                    <ExternalLink size={12} />
                  </a>
                )}
              </div>
            )}
            {!item.address && item.gmapLink && (
              <a
                href={item.gmapLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center text-blue-600 hover:text-blue-800"
              >
                <MapPin size={12} className="mr-2 shrink-0" />
                <span>View on Maps</span>
                <ExternalLink size={10} className="ml-1" />
              </a>
            )}
            {item.clientPhone && (
              <a
                href={`tel:${item.clientPhone}`}
                className="flex items-center hover:text-slate-900"
              >
                <Phone size={12} className="mr-2 text-slate-400 shrink-0" />
                <span>{item.clientPhone}</span>
              </a>
            )}
            {assignees.length > 0 && (
              <div className="flex items-center">
                <User size={12} className="mr-2 text-slate-400 shrink-0" />
                <span className="truncate">{assignees.join(", ")}</span>
              </div>
            )}
          </div>

          {item.type === "task" && (
            <div className="pt-1.5">
              <button
                type="button"
                onClick={() => void openTaskDetail(item.taskId)}
                disabled={isTaskLoading}
                className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 hover:text-slate-800 cursor-pointer transition-colors disabled:opacity-50"
              >
                <Eye size={12} />
                {isTaskLoading ? "Opening…" : "View task"}
              </button>
            </div>
          )}

          {canReschedule(item) && (onRescheduleSiteVisit || onRescheduleInstallation) && (
            <div className="pt-1.5">
              <button
                type="button"
                onClick={() => openReschedule(item)}
                className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 hover:text-slate-800 cursor-pointer transition-colors"
              >
                <CalendarClock size={12} />
                Reschedule
              </button>
            </div>
          )}
        </div>
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      today,
      orderDetailBasePath,
      employeeNameById,
      onRescheduleSiteVisit,
      onRescheduleInstallation,
      openTaskDetail,
      taskLoadingId,
    ]
  );

  return (
    <div className="space-y-4 sm:space-y-6" style={{ padding: "16px 16px 28px" }}>
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <CalendarDays size={18} className="text-[var(--color-primary,#1E40AF)] shrink-0" />
            <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 m-0 truncate">
              {title}
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 m-0">{subtitle}</p>
        </div>

        <div className="flex items-center gap-2 self-start">
          {/* View mode toggle */}
          <div className="flex items-center bg-white border border-[var(--border)] rounded-[var(--radius-lg)] p-0.5">
            {(["month", "week", "today"] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setViewMode(mode)}
                className={`px-2.5 py-1 rounded-md text-[10px] font-bold cursor-pointer transition-colors capitalize ${
                  viewMode === mode
                    ? "bg-slate-900 text-white"
                    : "text-slate-500 hover:bg-slate-50"
                }`}
              >
                {mode === "today" ? "Today" : mode === "week" ? "Week" : "Month"}
              </button>
            ))}
          </div>

          {/* Navigation */}
          {viewMode === "month" && (
            <div className="flex items-center gap-1 bg-white border border-[var(--border)] rounded-[var(--radius-lg)] p-1">
              <button
                type="button"
                onClick={() => shiftMonth(-1)}
                className="p-1.5 hover:bg-slate-50 rounded text-slate-600 cursor-pointer"
                aria-label="Previous month"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-xs font-bold text-slate-700 px-2 min-w-[8.5rem] text-center">
                {monthLabel(viewYear, viewMonth)}
              </span>
              <button
                type="button"
                onClick={() => shiftMonth(1)}
                className="p-1.5 hover:bg-slate-50 rounded text-slate-600 cursor-pointer"
                aria-label="Next month"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}

          {viewMode === "week" && (
            <div className="flex items-center gap-1 bg-white border border-[var(--border)] rounded-[var(--radius-lg)] p-1">
              <button
                type="button"
                onClick={() => shiftWeek(-1)}
                className="p-1.5 hover:bg-slate-50 rounded text-slate-600 cursor-pointer"
                aria-label="Previous week"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-xs font-bold text-slate-700 px-2 min-w-[10rem] text-center">
                {weekLabel(weekDays)}
              </span>
              <button
                type="button"
                onClick={() => shiftWeek(1)}
                className="p-1.5 hover:bg-slate-50 rounded text-slate-600 cursor-pointer"
                aria-label="Next week"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}

          {/* Jump to today */}
          <button
            type="button"
            onClick={jumpToToday}
            className="px-2.5 py-1.5 text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-200 rounded-[var(--radius-lg)] hover:bg-blue-100 cursor-pointer transition-colors"
          >
            Today
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center bg-white border border-[var(--border)] rounded-[var(--radius-lg)] p-3">
        <div className="flex items-center justify-between gap-2 sm:contents">
          <div className="flex items-center gap-1.5 text-slate-500 text-xs font-semibold uppercase tracking-wide">
            <Filter size={13} />
            Filters
          </div>
          <button
            type="button"
            title="Reset filters"
            onClick={resetFilters}
            className="inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-xs font-bold shrink-0 sm:order-last sm:ml-auto cursor-pointer"
          >
            <RefreshCw size={13} />
            Reset
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {(
            [
              ["all", "All types"],
              ["site_visit", "Site visits"],
              ["installation", "Installations"],
              ["deadline", "Deadlines"],
              ["task", "Tasks"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setTypeFilter(value);
                if (value === "deadline") setShowDeadlines(true);
              }}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold border cursor-pointer transition-colors ${
                typeFilter === value
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {showEmployeeFilter && !lockedEmployeeId && employees.length > 0 && (
          <select
            value={employeeFilter}
            onChange={(e) => setEmployeeFilter(e.target.value)}
            className="w-full sm:w-auto text-xs font-medium border border-slate-200 rounded-md px-2.5 py-1.5 bg-white text-slate-700"
          >
            <option value="all">All employees</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        )}

        <label className="flex items-center gap-2 text-xs font-medium text-slate-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={upcomingOnly}
            onChange={(e) => setUpcomingOnly(e.target.checked)}
            className="rounded border-slate-300"
          />
          Upcoming only
        </label>

        <label className="flex items-center gap-2 text-xs font-medium text-slate-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showDeadlines}
            onChange={(e) => {
              setShowDeadlines(e.target.checked);
              if (!e.target.checked && typeFilter === "deadline") setTypeFilter("all");
            }}
            className="rounded border-slate-300"
          />
          Show deadlines
        </label>
      </div>

      {/* ======= MONTH VIEW ======= */}
      {viewMode === "month" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
          <div className="lg:col-span-8 prt-card p-3 sm:p-5">
            <div className="grid grid-cols-7 gap-1 sm:gap-2 text-center text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 sm:mb-3">
              {WEEKDAYS.map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1 sm:gap-2">
              {cells.map((cell) => {
                const dayEvents = eventsByDate.get(cell.dateKey) || [];
                const isSelected = cell.dateKey === selectedDate;
                const isToday = cell.dateKey === today;
                const types = [...new Set(dayEvents.map((e) => e.type))];

                return (
                  <button
                    key={cell.dateKey}
                    type="button"
                    onClick={() => setSelectedDate(cell.dateKey)}
                    className={`aspect-square sm:min-h-[4.25rem] sm:aspect-auto p-1 sm:p-1.5 text-left rounded-[var(--radius-md)] border flex flex-col transition-colors cursor-pointer ${
                      !cell.inMonth
                        ? "bg-slate-50/50 text-slate-300 border-transparent"
                        : isSelected
                          ? "bg-slate-900 text-white border-slate-900"
                          : isToday
                            ? "bg-blue-50 border-blue-200 text-blue-800"
                            : dayEvents.length > 0
                              ? "bg-white border-slate-200 hover:bg-slate-50 text-slate-800"
                              : "bg-white border-[var(--border)] text-slate-700 hover:bg-slate-50/50"
                    }`}
                  >
                    <span
                      className={`text-[10px] sm:text-xs font-semibold leading-none ${
                        isSelected ? "text-white" : ""
                      }`}
                    >
                      {cell.day}
                    </span>

                    {dayEvents.length > 0 && (
                      <div className="mt-auto flex flex-col gap-0.5 w-full">
                        <div className="hidden sm:flex flex-wrap gap-0.5">
                          {types.slice(0, 3).map((t) => (
                            <span
                              key={t}
                              className={`text-[8px] font-bold px-1 rounded truncate max-w-full ${
                                isSelected
                                  ? "bg-white/20 text-white"
                                  : TYPE_META[t].badge
                              }`}
                            >
                              {TYPE_META[t].short}
                            </span>
                          ))}
                          {dayEvents.length > 3 && (
                            <span
                              className={`text-[8px] font-bold ${
                                isSelected ? "text-white/80" : "text-slate-400"
                              }`}
                            >
                              +{dayEvents.length - 3}
                            </span>
                          )}
                        </div>
                        <div className="flex sm:hidden gap-0.5 self-end">
                          {types.slice(0, 3).map((t) => (
                            <span
                              key={t}
                              className={`w-1.5 h-1.5 rounded-full ${
                                isSelected ? "bg-white" : TYPE_META[t].dot
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="hidden sm:flex flex-wrap gap-3 mt-4 pt-3 border-t border-slate-100 text-[10px] font-semibold text-slate-500">
              {(Object.keys(TYPE_META) as CalendarEventType[]).map((t) => (
                <span key={t} className="inline-flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${TYPE_META[t].dot}`} />
                  {TYPE_META[t].label}
                </span>
              ))}
            </div>
          </div>

          {/* Agenda sidebar */}
          <div className="lg:col-span-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 m-0">
                Agenda · {formatDisplayDate(selectedDate)}
              </h3>
              <span className="text-[10px] font-semibold text-slate-400">
                {selectedEvents.length} event{selectedEvents.length === 1 ? "" : "s"}
              </span>
            </div>

            <div className="space-y-3 max-h-[28rem] lg:max-h-[36rem] overflow-y-auto pr-0.5">
              {selectedEvents.map((item) => renderEventCard(item))}

              {selectedEvents.length === 0 && (
                <div className="bg-slate-50 border border-slate-200 border-dashed rounded-[var(--radius-xl)] p-8 text-center text-slate-400 text-xs font-semibold">
                  No events scheduled
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ======= WEEK VIEW ======= */}
      {viewMode === "week" && (
        <div className="prt-card p-3 sm:p-5">
          <div className="grid grid-cols-7 gap-2">
            {weekDays.map((dayKey) => {
              const dayEvents = eventsByDate.get(dayKey) || [];
              const isToday = dayKey === today;
              const dayName = new Date(...(dayKey.split("-").map(Number) as [number, number, number])).toLocaleDateString("en-IN", { weekday: "short" });
              const dayNum = dayKey.split("-")[2];

              return (
                <div key={dayKey} className="min-w-0">
                  <div
                    className={`text-center pb-2 mb-2 border-b ${
                      isToday ? "border-blue-300" : "border-slate-100"
                    }`}
                  >
                    <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      {dayName}
                    </div>
                    <div
                      className={`text-sm font-extrabold ${
                        isToday ? "text-blue-600" : "text-slate-700"
                      }`}
                    >
                      {parseInt(dayNum)}
                    </div>
                  </div>
                  <div className="space-y-2 min-h-[6rem]">
                    {dayEvents.map((item) => {
                      const meta = TYPE_META[item.type];
                      const status = eventStatus(item, today);
                      const isOverdue = status === "overdue";
                      const href =
                        item.type === "task"
                          ? taskDetailBasePath || "#"
                          : `${orderDetailBasePath}/${item.orderCode || item.orderId}`;
                      return (
                        <div
                          key={item.id}
                          className={`p-2 rounded-lg border text-[10px] space-y-1 ${
                            isOverdue
                              ? "border-l-2 border-l-red-400 border-t-[var(--border)] border-r-[var(--border)] border-b-[var(--border)] bg-red-50/30"
                              : "border-[var(--border)] bg-white"
                          }`}
                        >
                          <div className="flex items-center gap-1">
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${meta.dot}`} />
                            <span className="font-bold truncate">{meta.short}</span>
                          </div>
                          {item.type === "task" ? (
                            <button
                              type="button"
                              onClick={() => void openTaskDetail(item.taskId)}
                              className="font-semibold text-slate-700 hover:text-blue-700 block truncate text-left w-full cursor-pointer"
                            >
                              {item.projectName}
                            </button>
                          ) : (
                            <Link
                              href={href}
                              className="font-semibold text-slate-700 hover:text-blue-700 block truncate"
                            >
                              {item.projectName}
                            </Link>
                          )}
                          {item.time && (
                            <div className="text-slate-400 font-medium">{item.time}</div>
                          )}
                          <div className="flex flex-wrap gap-1">
                            {(item.gmapLink || item.address) && (
                              <a
                                href={item.gmapLink || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.address!)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-500 hover:text-blue-700"
                                title="Maps"
                              >
                                <MapPin size={10} />
                              </a>
                            )}
                            {(item.outstandingAmount ?? 0) > 0 && (
                              <span className="text-[8px] font-bold px-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                                {formatCurrency(item.outstandingAmount!)}
                              </span>
                            )}
                          </div>
                          {canReschedule(item) && (onRescheduleSiteVisit || onRescheduleInstallation) && (
                            <button
                              type="button"
                              onClick={() => openReschedule(item)}
                              className="text-slate-400 hover:text-slate-700 cursor-pointer"
                              title="Reschedule"
                            >
                              <CalendarClock size={10} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                    {dayEvents.length === 0 && (
                      <div className="text-[9px] text-slate-300 font-medium text-center pt-4">
                        No events scheduled
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ======= TODAY STRIP ======= */}
      {viewMode === "today" && (
        <div className="space-y-4">
          {overdueCount > 0 && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-[var(--radius-lg)] px-4 py-2.5">
              <AlertCircle size={14} className="text-red-500 shrink-0" />
              <span className="text-xs font-bold text-red-700">
                {overdueCount} overdue event{overdueCount === 1 ? "" : "s"}
              </span>
            </div>
          )}

          {todayStripDays.map((dayKey) => {
            const dayEvents = eventsByDate.get(dayKey) || [];
            const isToday = dayKey === today;

            return (
              <div key={dayKey}>
                <div className={`flex items-center gap-2 mb-2 ${isToday ? "text-blue-700" : "text-slate-500"}`}>
                  <h3 className="text-[11px] font-bold uppercase tracking-wider m-0">
                    {isToday ? "Today" : formatDisplayDate(dayKey)}
                  </h3>
                  <span className="text-[10px] font-semibold text-slate-400">
                    {dayEvents.length} event{dayEvents.length === 1 ? "" : "s"}
                  </span>
                </div>

                {dayEvents.length > 0 ? (
                  <div className="space-y-3">
                    {dayEvents.map((item) => renderEventCard(item, true))}
                  </div>
                ) : (
                  <div className="bg-slate-50 border border-slate-200 border-dashed rounded-[var(--radius-xl)] p-4 text-center text-slate-400 text-xs font-semibold">
                    No events scheduled
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ======= RESCHEDULE MODAL ======= */}
      {rescheduleEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm space-y-4">
            <h3 className="text-sm font-extrabold text-slate-900">
              Reschedule {TYPE_META[rescheduleEvent.type].label}
            </h3>
            <p className="text-xs text-slate-500">
              {rescheduleEvent.projectName} · {rescheduleEvent.orderCode}
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Date
                </label>
                <input
                  type="date"
                  value={rescheduleDate}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Time
                </label>
                <input
                  type="time"
                  value={rescheduleTime}
                  onChange={(e) => setRescheduleTime(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>

            {rescheduleError && (
              <p className="text-xs text-red-600 font-semibold">{rescheduleError}</p>
            )}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setRescheduleEvent(null)}
                disabled={isPending}
                className="flex-1 px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 rounded-lg cursor-pointer hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReschedule}
                disabled={isPending || !rescheduleDate}
                className="flex-1 px-4 py-2 text-xs font-bold text-white bg-slate-900 rounded-lg cursor-pointer hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                {isPending ? "Saving…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedTask ? (
        <TaskDetailPanel
          task={selectedTask}
          isAdmin={isAdmin}
          onClose={() => setSelectedTask(null)}
        />
      ) : null}
    </div>
  );
}
