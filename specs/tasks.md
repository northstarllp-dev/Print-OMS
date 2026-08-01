# Task Management Specification

## Overview

- Purpose: allow Admin users to assign and track internal employee tasks that may or may not be linked to orders.
- Portals:
  - Admin: full assignment and tracking dashboard.
  - Staff: My Tasks workspace scoped to assignee.

## Task categories

- Order Related
- Internal
- Follow Up
- Maintenance
- Purchase
- HR

## Task types

- Sales
- Production
- Inventory
- Design
- Installation
- Accounts
- Administration

## Task statuses

- Not Started
- In Progress
- Waiting for Approval
- Blocked
- Completed
- Cancelled

## Priority

- Critical
- High
- Medium
- Low

## Permissions

| Role | Access |
| ---- | ------ |
| `admin` | Create/assign any task; open task detail |
| `staff` | View and complete only tasks assigned to self; add comments |

## Employee views

- `/staff/tasks` sections:
  - Today's Tasks
  - Overdue Tasks
  - Upcoming Tasks
  - Completed Tasks
- Task detail supports **Mark Completed** and **Comments** only.

## Admin views

- `/admin/tasks` task dashboard with:
  - assignee
  - title/task id
  - priority
  - due date
  - status
- Admin sidebar has dedicated **Tasks** nav item.

## Calendar integration

- Calendar event type: `task`
- Two task events are emitted when dates exist:
  - assigned date (`assigned_at`)
  - deadline (`due_date`)
- Clicking a calendar task opens the same compact detail popup.
- Type filter includes a dedicated **Tasks** option.

## Order timeline hook

- When an order-linked task is marked `Completed`, add an `order_activity` timeline event with `metadata.action = "task_completed"`.
- Task assignment to an order also writes a timeline note with `metadata.action = "task_assigned"`.

## Database

### Tables

- `tasks` (comments stored as `comments` jsonb on the task row)

### Removed

- `tasks.progress`
- `task_attachments`
- `task_history`
- `task_comments` (folded into `tasks.comments`)

### Migrations

- `supabase/migrations/20260730150000_create_tasks.sql`
- `supabase/migrations/20260730160000_simplify_tasks.sql`
- `supabase/migrations/20260730210000_consolidate_module_tables.sql`

## File structure

```
src/features/tasks/types.ts
src/features/tasks/actions/taskActions.ts
src/features/tasks/components/TasksDashboard.tsx
src/features/tasks/components/CreateTaskModal.tsx
src/features/tasks/components/TaskDetailPanel.tsx
src/features/tasks/components/MyTasksView.tsx
src/app/admin/(dashboard)/tasks/page.tsx
src/app/staff/(dashboard)/tasks/page.tsx
specs/tasks.md
```

## Change Log

| Version | Date | Summary |
| ------- | ---- | ------- |
| 1.0 | 2026-07-30 | Initial implementation: schema, admin/staff task UIs, calendar task filter/events, order timeline integration |
| 1.1 | 2026-07-30 | Simplified detail to Mark Completed + Comments; removed progress, attachments, history |
