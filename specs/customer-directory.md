# Customer CRM Directory Feature Specification

## Overview

* Purpose of the feature: Provide a centralized database of all clients, their contact information, and their historical relationship with the business.
* Business objective: Allow staff to quickly look up returning customers, view past orders, avoid duplicate data entry during the Enquiry phase, and understand the lifetime value of a client.
* User roles involved: Admin, Staff

## Workflow

1. **Automatic Creation**: When a new Enquiry is submitted with a phone number/email not currently in the system, a new Customer profile is automatically generated behind the scenes.
2. **Manual Creation**: Admin/Staff navigates to the Customers tab and clicks "Add Customer" for proactive outreach or B2B onboarding.
3. **Lookup & Association**: During a new Enquiry, staff can search for an existing customer by name or phone number. Selecting them auto-fills the contact details and links the new order to their existing profile.
4. **Historical Review**: Staff can click on a specific Customer profile to view a list of all their past and active orders, total lifetime spend, and outstanding balances.

## Workflow States

* Customers have the following `status` options:
  * **Active**: Currently doing business or in good standing.
  * **Inactive**: No recent activity.
  * **Pending**: Needs review or missing info.
  * **Blocked**: Flagged by admin for non-payment or other issues.
  * **Archived**: Hidden from default views.

## Business Rules

* Customer records are bound to a specific `company_id` in a multi-tenant environment.
* The system attempts to prevent duplicate customer profiles by matching against phone numbers or email addresses during manual creation or enquiry intake.

## User Roles

### Admin

Permissions:
* Full CRUD access to all customer records.
* Can merge duplicate customer profiles (Future enhancement).

### Staff

Permissions:
* Can create new customers.
* Can view customer details and history to assist in sales.

## Database Design

### Relevant Tables

#### customers

| Column | Type | Description |
| ------ | ---- | ----------- |
| id | uuid (PK) | Unique customer ID |
| company_id | uuid (FK) | Reference to the tenant company |
| customer_id | varchar | Auto-generated friendly ID (e.g., CUST-001) |
| name | text | Company/Entity name or client's name |
| contact_person | text | Primary point of contact |
| phone | text | Primary phone number |
| whatsapp | text | WhatsApp contact number |
| email | text | Email address |
| city | text | City of operation |
| billing_address | text | Billing address |
| shipping_address | text | Shipping/delivery address |
| gst_number | text | Tax ID for invoicing (optional) |
| customer_type | text | Retail, Corporate, or Dealer |
| status | text | Active, Inactive, Blocked, etc. |

## API Endpoints

### Customer Lookup / Search
Method: Server Action or standard query.
Behavior: Performs search on `name`, `phone`, or `email`.

### Manage Customers
Method: Server Actions (`createCustomer`, `updateCustomer`)
Behavior: Standard DB upserts.

## UI Components

### Customer List View
Purpose: Tabular view of all customers with a search bar and pagination.

### Customer Detail View
Purpose: A deep-dive page showing the customer's contact card on the left, and a data table of their associated `orders` on the right.

## File Structure

* `src/features/customers/components/CustomersViewNew.tsx`
* `src/features/customers/actions/customerActions.ts`
* `src/features/customers/customerLogic.ts`

## Data Flow

Staff creates a new Enquiry for a returning client
→ Staff types in the search bar
→ Query fetches matching `customers`
→ Staff selects a customer
→ The `order` being created is assigned the selected `customer.id`.

## Future Enhancements

* **Customer Tags**: Add tags like "VIP", "Wholesale", or "Late Payer" to help staff categorize clients.
* **Communication Log**: A timeline on the customer profile showing all SMS/Emails sent to them across *all* orders.

## Change Log

Version: 1.0
Date: 2026-07-03
Summary: Initial specification for the Customer CRM Directory.
