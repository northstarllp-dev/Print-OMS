# Company Calendar Specification

## Overview

The company calendar combines **derived** schedule events (orders, site visits, installations, production deadlines, tasks, On Hold reach-out dates) with **user-created reminders** stored in `calendar_reminders`.

## Event sources

| Type | Source | Date field | Notes |
| ---- | ------ | ---------- | ----- |
| Site Visit | `site_visits` | `audit_date` / `preferred_date` | Address + gmapLink from visit row preferred over customer |
| Installation | `installations` | `scheduled_date` | Address from install row or customer shipping |
| Production Deadline | `productions` | `deadline` | Read-only; links to production tab |
| Task (Assigned) | `tasks` | `assigned_at` | Internal task assignment marker |
| Task (Due) | `tasks` | `due_date` | Internal deadline marker |
| Hold follow-up | `orders` / `enquiries` | `reach_out_at` | When health is On Hold; shows `hold_note` |
| Reminder | `calendar_reminders` | `reminder_date` | User-created; visibility via `viewer_ids` + creator |

## On Hold reach-out

Putting an order or enquiry **On Hold** requires:

1. A note (`hold_note`)
2. A reach-out date (`reach_out_at`)

These appear on the calendar as `hold_followup` events.

**Visibility**

| Actor | Sees hold follow-ups? |
| ----- | --------------------- |
| Admin | Yes (orders + enquiries) |
| Staff with enquiry `canView` or `canEdit` | Yes |
| Other staff | No |

Leaving On Hold (or setting Lost/Active) clears `hold_note` and `reach_out_at`.

## Reminders

Anyone on admin or staff calendar can **Add reminder**:

- Title (required), date (required), optional note
- **Visible to**: multi-select employees (creator always sees it)
- Stored in `calendar_reminders` (company-scoped RLS)
- Creator or admin can delete

Staff list filters to reminders where they are creator or listed in `viewer_ids`.

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
Admin / Staff Calendar page
  → fetch orders (nested schedules + health/hold fields)
  → fetch enquiries (if enquiry access)
  → fetch payment summaries, tasks, reminders
  → buildCalendarEvents(..., { enquiries, reminders, includeHoldFollowups })
  → CompanyCalendarView
```

Staff calendar locks the employee filter to the current user (hold follow-ups bypass assignee filter when included).

## Filters

- Event type: Site Visit / Installation / Deadline / Tasks / Hold follow-ups / Reminders
- Employee / assignee (admin only; staff locked)
- Upcoming only (hide past events)
- Show/hide deadlines

## File structure

```
src/features/calendar/types.ts
src/features/calendar/buildCalendarEvents.ts
src/features/calendar/actions/reminderActions.ts
src/features/calendar/components/CompanyCalendarView.tsx
src/features/calendar/components/HoldFollowUpModal.tsx
src/features/calendar/components/AddReminderModal.tsx
src/app/admin/(dashboard)/calendar/page.tsx
src/app/staff/(dashboard)/calendar/page.tsx
specs/calendar.md
```

## Change Log

| Version | Date | Summary |
| ------- | ---- | ------- |
| 1.0 | 2026-07-29 | Initial spec: derived calendar with month/week/today views, reschedule, ops badges |
| 1.1 | 2026-07-30 | Added task events (assigned + due) and separate Tasks type filter |
| 1.2 | 2026-08-04 | On Hold note + reach_out_at on calendar; calendar_reminders with viewer list |
