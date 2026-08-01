# Company Calendar Specification

## Overview

The company calendar is a **derived** view — it reads scheduled dates from orders, site visits, installations, production deadlines, and internal tasks. There is no standalone `calendar_events` table.

## Event sources

| Type | Source table | Date field | Notes |
| ---- | ----------- | ---------- | ----- |
| Site Visit | `site_visits` | `audit_date` / `preferred_date` | Address + gmapLink from visit row preferred over customer |
| Installation | `installations` | `scheduled_date` | Address from install row or customer shipping |
| Production Deadline | `productions` | `deadline` | Read-only; links to production tab |
| Task (Assigned) | `tasks` | `assigned_at` | Internal task assignment marker |
| Task (Due) | `tasks` | `due_date` | Internal deadline marker |

Events are built client-side by `buildCalendarEvents` from order nested data.

## Views

| View | Behavior |
| ---- | -------- |
| **Month** | Grid with day cells; click day → agenda sidebar |
| **Week** | 7-day (Mon–Sun) strip for the selected week; prev/next week nav |
| **Today** | Today's events + next 7 days agenda; overdue count badge |

All views share a "Jump to today" button and type/employee filters.

## Ops badges

| Badge | When shown | Style |
| ----- | ---------- | ----- |
| Outstanding amount | Order has unpaid balance > 0 | Amber chip (`₹12,500 due`) |
| Maps link | `gmapLink` or address available | Map pin icon → opens Google Maps |

## Reschedule

Site visit and installation events can be rescheduled from the agenda:

1. Click **Reschedule** on the event card.
2. Date (and time if supported) picker opens.
3. On confirm, calls existing server actions (`scheduleSiteVisit` / `scheduleInstallation`).
4. Calendar refreshes.

Production deadlines are **not** reschedulable from the calendar (edit via order worksheet).

## Data flow

```
Admin Calendar page
  → fetch orders (with nested site_visits, installations, productions)
  → fetch payment summaries (outstanding per order)
  → fetch tasks
  → buildCalendarEvents(orders, paymentMap, tasks)
  → CompanyCalendarView (month / week / today)
```

Staff calendar locks the employee filter to the current user.

## Filters

- Event type: Site Visit / Installation / Deadline / Tasks
- Employee / assignee (admin only; staff locked)
- Upcoming only (hide past events)
- Show/hide deadlines

## File structure

```
src/features/calendar/types.ts
src/features/calendar/buildCalendarEvents.ts
src/features/calendar/components/CompanyCalendarView.tsx
src/app/admin/(dashboard)/calendar/page.tsx
src/app/staff/(dashboard)/calendar/page.tsx
specs/calendar.md
```

## Change Log

| Version | Date | Summary |
| ------- | ---- | ------- |
| 1.0 | 2026-07-29 | Initial spec: derived calendar with month/week/today views, reschedule, ops badges |
| 1.1 | 2026-07-30 | Added task events (assigned + due) and separate Tasks type filter |
