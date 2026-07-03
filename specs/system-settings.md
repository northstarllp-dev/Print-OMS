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

*(Note: Depending on the exact schema, this might be a single row table for single-tenant, or keyed by `company_id` for multi-tenant).*

## API Endpoints

### Update Settings
Method: Server Action (e.g., `updateCompanySettings`)
Behavior: Updates the row in the database associated with the current user's tenant.

## UI Components

### Settings Dashboard (`SettingsView.tsx`)
Purpose: Form-heavy page split into logical sections.
Fields:
* **Company Profile**: Name, Logo Upload, Address, Contact Info.
* **Financial Defaults**: Tax Rates, Currency.
* **Document Templates**: Large Textareas for Default Quote Terms and Invoice Terms.

## File Structure

* `src/features/settings/components/SettingsView.tsx`
* `src/features/settings/actions/settingsActions.ts`

## Data Flow

Admin updates "Default Quote Terms" and clicks Save
→ Server action updates the `companies` table
→ Later, Staff clicks "Create Quote" on an order
→ The Quotation initialization logic fetches the `companies.default_quote_terms` and pre-fills the `terms` field on the new quotation row.

## Future Enhancements

* **Email/WhatsApp Templates**: Allow admins to customize the exact text that gets sent when they click "Send Quote to Customer", including dynamic variables like `{{customer_name}}` and `{{order_id}}`.
* **Webhook Integrations**: A section for admins to add a webhook URL (like Zapier or Make) that fires whenever an order reaches the "Completed" stage.

## Change Log

Version: 1.0
Date: 2026-07-03
Summary: Initial specification for the System Settings module.
