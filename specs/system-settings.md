# System Settings & Configuration Feature Specification

## Overview

* Purpose of the feature: Allow administrators to configure the global variables, branding, and defaults for their tenant workspace in the OMS.
* Business objective: Make the software flexible enough to handle changes in tax laws (GST rates), company branding (logo/address on quotes), and standardized legal text without requiring code deployments.
* User roles involved: Admin (Exclusive)

## Workflow

1. **Access**: Admin navigates to the Settings module in the dashboard sidebar.
2. **Configuration**: Admin modifies company details, default terms and conditions, or adds predefined tax brackets.
3. **Application**: These settings are saved to the `companies` or `tenant_settings` table.
4. **Consumption**: Whenever a new Quotation is generated, it pulls the "Default Terms & Conditions" from Settings. Whenever a PDF is exported, it pulls the Company Logo and Address from Settings.

## Workflow States

* Settings are state-less (simple Key-Value pairs or column updates).

## Business Rules

* Strictly limited to Admin users. Staff cannot view or modify these settings.
* Changes to global settings like "Default Quotation Terms" only apply to *newly created* quotes moving forward. Existing quotes retain the terms they were generated with to preserve legal integrity.

## User Roles

### Admin

Permissions:
* View and edit all system settings.

### Staff / Customer

Permissions:
* No direct access. They only see the results of these settings (e.g., the logo on the portal).

## Database Design

### Relevant Tables

#### companies (or tenant_settings)

| Column | Type | Description |
| ------ | ---- | ----------- |
| id | uuid (PK) | Unique company/tenant ID |
| name | text | Business Name |
| logo_url | text | Storage URL for the company logo |
| address | text | Official registered address for invoicing |
| gst_number | text | Official Tax ID |
| default_quote_terms | text | Standard T&C block injected into new quotes |
| currency_symbol | text | e.g., "₹" or "$" |

#### app_settings

| Column | Type | Description |
| ------ | ---- | ----------- |
| id | uuid (PK) | Settings record ID |
| company_id | uuid (FK) | Links to `companies.id` |
| site_visit_scheduling_enabled | boolean | Toggles self-scheduling for site visits in portal |
| installation_scheduling_enabled | boolean | Toggles self-scheduling for installations in portal |

*(Note: `app_settings` is keyed by `company_id` for multi-tenant isolation).*

## API Endpoints

### Update Settings
Method: Server Action (e.g., `updateAppSettings`)
Behavior: Updates the row in the `app_settings` or `companies` table associated with the current user's tenant.

## UI Components

### Settings Dashboard (`SettingsViewNew.tsx`)
Purpose: Form-heavy page split into logical sections.
Fields:
* **General Settings**: Company Name, Email, Address, etc.
* **Customer Portal**: Toggles for enabling/disabling customer self-scheduling.

## File Structure

* `src/features/settings/components/SettingsViewNew.tsx`
* `src/features/settings/actions/settingsActions.ts`

## Data Flow

Admin updates "Site Visit Self-Scheduling" and clicks Save
→ Server action updates the `app_settings` table
→ Later, Customer visits their portal
→ The portal fetches `app_settings` and conditionally renders the scheduling form or a read-only message.

## Future Enhancements

* **Email/WhatsApp Templates**: Allow admins to customize the exact text that gets sent when they click "Send Quote to Customer", including dynamic variables like `{{customer_name}}` and `{{order_id}}`.
* **Webhook Integrations**: A section for admins to add a webhook URL (like Zapier or Make) that fires whenever an order reaches the "Completed" stage.

## Change Log

Version: 1.0
Date: 2026-07-03
Summary: Initial specification for the System Settings module.

Version: 1.1
Date: 2026-07-06
Summary: Added `app_settings` table to handle Customer Portal feature toggles (Site Visit & Installation Scheduling).
