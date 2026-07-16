# Reports & Analytics Feature Specification

## Overview

The Reports & Analytics feature provides administrators with a centralized dashboard to track company-wide metrics and visualize data. It is built to support both standardized (template) reports and interactive custom reports generated through a conversational interface.

The feature uses **shadcn/ui** for UI components and **Recharts** for data visualization to ensure an aesthetically pleasing and responsive experience.

## Key Features

1. **Template Reports**
   - Pre-built KPI cards displaying aggregated metrics (e.g., Total Active Orders, Conversion Rate, Pipeline Value).
   - Visual charts powered by Recharts (BarCharts, LineCharts, PieCharts) to show trends over time (e.g., Revenue by Month, Lost Reasons).
   
2. **Interactive Chat Box (Custom Reports)**
   - A conversational interface where administrators can type natural language queries (e.g., "Show me the revenue for the last 30 days" or "Which products are selling the most?").
   - The chat box allows clients to request specific data cuts on the fly without needing complex query builders.

3. **Global Date Filtering**
   - A "Date From" and "Date To" filter is available globally across the reports dashboard.
   - Adjusting these dates instantly filters all templates and KPIs to reflect the selected timeframe.
   - A quick reset ("X") button is available to clear the active date range.

## Workflow

1. **Access**: The Admin navigates to the `/admin/reports` route.
2. **Data Fetching**: The `ReportsPage` Server Component fetches aggregated data via `getReportData(startDate, endDate)` in `reportActions.ts`.
3. **Filtering**: If the Admin changes the date range using the date pickers, the URL updates with `from` and `to` search parameters. The server component re-runs the data fetch and passes the filtered data to the `ReportsPageClient`.
4. **Custom Queries**: Admin types a query into the chat box. The system processes the natural language request and renders a custom chart or data table in response.

## Technical Implementation

- **Data Action**: `src/features/reports/actions/reportActions.ts` (Handles data aggregation and filtering).
- **Client Components**: 
  - `src/features/reports/components/ReportsPageClient.tsx` (Main dashboard layout and date filters).
  - `src/features/reports/components/ReportCard.tsx` (Renders individual template charts using Recharts).
  - `src/features/reports/components/ReportChatBox.tsx` (Handles the conversational custom report UI).
- **Routing**: `src/app/admin/(dashboard)/reports/page.tsx` (Server component injecting data).

## Future Enhancements

- Integration of an actual LLM backend to dynamically construct SQL queries for the chat box.
- Export to PDF and CSV functionalities for all generated charts.
- Additional template reports focusing on employee performance and lead sources.
