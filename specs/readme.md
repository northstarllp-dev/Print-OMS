# Printec Order Management System (OMS) Specifications

This directory contains the definitive, production-ready specifications for the Printec Order Management System. It serves as the primary source of truth for AI coding assistants and human developers regarding business rules, database schema, user roles, and UI components.

## Core Architecture

The platform is split into two primary interfaces:
1. **[Admin & Staff Dashboard](admin-dashboard.md)**: The internal tool for employees to manage the pipeline, execute physical tasks, and oversee operations.
2. **[Customer Portal](customer-portal.md)**: A secure, password-less web interface for clients to track their orders, approve designs/quotes, and provide signatures.

## Order Lifecycle Overview

Every order in the CRM flows through a strict pipeline stage progression. The exact path depends on the `workflow_type` (`quote_first` vs `design_first`), determining whether the client sees the quotation or the design proofs first.

### 1. Initiation
* **[Customer Enquiry](customer-enquiry.md)**: Leads are captured and an `Order` is created in the system. A sales representative is assigned.
* **[Site Visit](site-visit.md)**: If a physical audit is required, the visit is scheduled. Staff visit the location, record measurements, assess electrical/structural readiness, and upload photos.

### 2. Planning & Approval (Dynamic Routing)
Depending on the project requirements, the order routes through one of two paths:

* **Quote-First Workflow** (Standard):
  1. **[Quotation](quotation.md)**: Estimators use the site visit measurements to draft a cost estimate.
  2. **[Customer Approval](customer-approval.md)**: The client approves the quote via the portal.
  3. **[Designer Workflow](designer-workflow.md)**: Designers upload visual proofs.
  4. **[Customer Approval](customer-approval.md)**: The client approves the design.

* **Design-First Workflow**:
  1. **[Designer Workflow](designer-workflow.md)**: Designers upload proofs to secure the visual concept first.
  2. **[Customer Approval](customer-approval.md)**: The client approves the design.
  3. **[Quotation](quotation.md)**: A final cost is calculated based on the approved complex design.
  4. **[Customer Approval](customer-approval.md)**: The client approves the final cost.

### 3. Execution
* **[Production](production.md)**: Workshop staff access the final approved vector files and track fabrication milestones (Procurement, Cutting, Wiring, QC).
* **[Installation](installation.md)**: The crew is scheduled, dispatched, and completes the on-site physical installation. They capture "after photos", collect pending payments, and acquire the customer's digital signature.

### 4. Oversight
* **[Reporting & Analytics](reporting.md)**: Admins track high-level metrics, conversion rates, pipeline values, and analyze lost opportunities.

### 5. Administrative Modules
* **[Product Catalog](product-catalog.md)**: Manage standardized pricing and items used in Quotations.
* **[Customer Directory](customer-directory.md)**: The global CRM database of all clients and their history.
* **[System Settings](system-settings.md)**: Global tenant configurations, defaults, and branding.

---

## Important Architectural Concepts

### Stage Locks (`stage_status`)
To ensure quality control, the system employs **Stage Locks**. When staff complete a major phase (like finishing a site visit or drafting a quote), the order transitions into a `"Pending Admin Approval"` state. The stage *cannot* progress until an Admin explicitly reviews the data and approves the transition.

### The Timeline (`order_activity`)
Every major action (approvals, rejections, scheduling, manual creation) is logged in the `order_activity` table. This serves as the audit trail and is displayed visually as the "Timeline" in both the Staff Dashboard and the Customer Portal.
