# Reporting & Analytics Feature Specification

## Overview

* Purpose of the feature: Aggregate data across all orders to provide high-level metrics, pipeline health tracking, and insights into lost opportunities.
* Business objective: Allow management to evaluate sales performance, identify operational bottlenecks (e.g., jobs stuck in production), and track revenue via approved quotations.
* User roles involved: Admin

## Workflow

1. **Data Aggregation**: As orders progress through the CRM, data is constantly written to `orders`, `quotations`, and `order_activity`.
2. **Dashboard Rendering**: Admin visits the reporting/analytics tab.
3. **Metric Calculation**: The system calculates key performance indicators (KPIs) in real-time or via materialized views:
   * Total Active Orders.
   * Total Orders needing attention (based on `health` flag).
   * Conversion Rate (Enquiry vs Quotation Approved).
   * Pipeline Value (Sum of `grand_total` from `quotations` in "Sent" or "Approved" state).
4. **Loss Analysis**: Admin views the "Lost Reasons" chart to see why leads are falling through (e.g., Price too high, Competitor, Unresponsive).

## Workflow States

Reporting doesn't have states itself, but it groups data based on:

| Metric Bucket | Related State / Field | Description |
| ------------- | --------------------- | ----------- |
| Active Pipeline | `orders.stage` != Completed/Closed | Current WIP |
| Stalled Orders | `orders.health` == "Needs Attention" | Auto-flagged after N days with no stage move |
| Realized Revenue | `quotations.status` == "Approved" | Confirmed sales |
| Lost Opportunities | `orders.health` == "Lost" | Soft-cancelled deals |

## Business Rules

* Only Admin roles can view aggregate financial data and company-wide reports.
* Data is strictly isolated by `company_id` for multi-tenant setups.
* `lost_reason` must be provided when an order health is manually changed to "Lost".
* Order health values: Active, Needs Attention, On Hold, Lost.

## User Roles

### Admin

Permissions:
* View all charts and tables.
* Export data to CSV (Future enhancement).

### Staff

Permissions:
* None (Restricted from aggregate financial views).

## Database Design

### Relevant Tables

#### orders
* `health`: Used for highlighting stalled or at-risk projects.
* `stage`: Used for funnel conversion tracking.
* `lost_reason`: Used for a pie chart breakdown of why deals fail.
* `date_created`: Used for filtering by date range.

#### quotations
* `grand_total`: Used to calculate revenue.

#### order_activity
* Used to measure velocity (e.g., average time from `Site Visit Completed` to `Quotation Approved`).

## API Endpoints

### Fetch Reporting Metrics (Planned)
Method: Server Action or standard API Route (`GET /api/reports/dashboard`)
Query Parameters: `startDate`, `endDate`, `companyId`.
Response:
```json
{
  "activeCount": 12,
  "needsAttentionCount": 3,
  "totalPipelineValue": 450000,
  "lostReasons": [
    { "reason": "Price Too High", "count": 5 }
  ]
}
```

## UI Components

### Analytics Dashboard
Purpose: Visual representation of data using charts (e.g., Recharts or Chart.js).
Fields:
* Date Range Picker.
* KPI Metric Cards (Pipeline Value, Active Orders).
* Funnel Chart (Enquiry → Quote → Production → Complete).
* Bar Chart (Orders by Stage).

## File Structure

* `src/app/admin/reports/page.tsx` (or similar Analytics route).
* `src/features/reports/actions/reportActions.ts` (Data aggregation logic).

## Data Flow

Admin requests Reports page
→ Server Action queries Supabase using aggregate functions (COUNT, SUM) grouped by `company_id`.
→ React renders visual charts.

## Error Handling

* Large queries: If the database grows too large, the system should implement pagination or caching for report generation to prevent timeouts.

## Notifications

* Weekly summary email to admins containing high-level stats (Future enhancement).

## Security Rules

* Supabase RLS policies enforce `company_id` filtering even on aggregate functions.
* Next.js route protection on `/reports`.

## Future Enhancements

* **Export to CSV/Excel**: Allow admins to download raw data for external accounting tools.
* **Staff Performance Reports**: Track which sales rep has the highest conversion rate, or which designer closes proofs fastest.
* **Material Cost Tracking**: Tie the `productions` milestones into a material cost database to calculate exact profit margins on completed jobs.

## Change Log

Version: 1.0
Date: 2026-07-03
Summary: Initial specification for the Reporting and Analytics Workflow.
