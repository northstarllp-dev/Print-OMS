"use client";

import React, { useMemo, useState } from "react";
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
  CalendarEventType,
  CalendarOrderInput,
} from "@/features/calendar/types";

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
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface CompanyCalendarViewProps {
  orders: CalendarOrderInput[];
  customers?: CalendarCustomerInput[];
  employees?: CalendarEmployeeInput[];
  title?: string;
  subtitle?: string;
  /** Base path for order links, e.g. /admin/orders or /staff/orders */
  orderDetailBasePath: string;
  /** When set, lock the calendar to this employee (staff personal view). */
  lockedEmployeeId?: string;
  showEmployeeFilter?: boolean;
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

export function CompanyCalendarView({
  orders,
  customers = [],
  employees = [],
  title = "Company Calendar",
  subtitle = "Site visits, installations, and production deadlines across the team.",
  orderDetailBasePath,
  lockedEmployeeId,
  showEmployeeFilter = true,
}: CompanyCalendarViewProps) {
  const today = todayDateKey();
  const initial = new Date();
  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth());
  const [selectedDate, setSelectedDate] = useState(today);

  const [typeFilter, setTypeFilter] = useState<"all" | CalendarEventType>("all");
  const [employeeFilter, setEmployeeFilter] = useState(lockedEmployeeId || "all");
  const [upcomingOnly, setUpcomingOnly] = useState(false);
  const [showDeadlines, setShowDeadlines] = useState(true);

  const employeeNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of employees) map.set(e.id, e.name);
    return map;
  }, [employees]);

  const allEvents = useMemo(
    () => buildCalendarEvents(orders, customers),
    [orders, customers]
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

  const shiftMonth = (delta: number) => {
    const d = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  };

  const resolveAssignees = (ids: string[]) =>
    ids
      .map((id) => employeeNameById.get(id) || id)
      .filter(Boolean)
      .slice(0, 3);

  return (
    <div className="space-y-4 sm:space-y-6" style={{ padding: "16px 16px 28px" }}>
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

        <div className="flex items-center gap-1 self-start bg-white border border-[var(--border)] rounded-[var(--radius-lg)] p-1">
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
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center bg-white border border-[var(--border)] rounded-[var(--radius-lg)] p-3">
        <div className="flex items-center gap-1.5 text-slate-500 text-xs font-semibold uppercase tracking-wide">
          <Filter size={13} />
          Filters
        </div>

        <div className="flex flex-wrap gap-2">
          {(
            [
              ["all", "All types"],
              ["site_visit", "Site visits"],
              ["installation", "Installations"],
              ["deadline", "Deadlines"],
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

        <label className="flex items-center gap-2 text-xs font-medium text-slate-600 cursor-pointer select-none sm:ml-auto">
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
        {/* Month grid */}
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

        {/* Agenda */}
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
            {selectedEvents.map((item) => {
              const meta = TYPE_META[item.type];
              const status = eventStatus(item, today);
              const assignees = resolveAssignees(item.assigneeIds);
              const href = `${orderDetailBasePath}/${item.orderCode || item.orderId}`;

              return (
                <div
                  key={item.id}
                  className="p-3.5 sm:p-4 bg-white border border-[var(--border)] rounded-[var(--radius-xl)] space-y-2.5"
                >
                  <div className="flex justify-between items-start gap-2">
                    <span
                      className={`prt-badge border uppercase text-[9px] ${meta.badge}`}
                    >
                      {meta.label}
                    </span>
                    {status === "overdue" && (
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

                  <div>
                    <Link
                      href={href}
                      className="font-bold text-slate-800 text-sm hover:text-[var(--color-primary,#1E40AF)] transition-colors"
                    >
                      {item.projectName}
                    </Link>
                    <span className="text-[10px] font-semibold text-slate-400 block mt-0.5">
                      {item.clientName} · {item.orderCode}
                    </span>
                  </div>

                  <div className="space-y-1.5 pt-2 border-t border-slate-50 text-xs text-slate-600 font-medium">
                    {(item.time || item.dateKey) && (
                      <div className="flex items-center">
                        <Clock size={12} className="mr-2 text-slate-400 shrink-0" />
                        <span>
                          {formatDisplayDate(item.dateKey)}
                          {item.time ? ` at ${item.time}` : ""}
                        </span>
                      </div>
                    )}
                    {item.address && (
                      <div className="flex items-start">
                        <MapPin size={12} className="mr-2 mt-0.5 text-slate-400 shrink-0" />
                        <span className="line-clamp-2">{item.address}</span>
                      </div>
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
                </div>
              );
            })}

            {selectedEvents.length === 0 && (
              <div className="bg-slate-50 border border-slate-200 border-dashed rounded-[var(--radius-xl)] p-8 text-center text-slate-400 text-xs font-semibold">
                No events on this day.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
