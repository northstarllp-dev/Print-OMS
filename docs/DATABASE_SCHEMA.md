# Printoms Database Schema

> **Last Updated:** 2026-07-04
> **Platform:** Supabase (PostgreSQL 17)
> **Total Tables:** 18+ (public) including `designs`, `productions`, `installations`, `payments`

---

## Table of Contents

1. [Schema Overview](#schema-overview)
2. [Entity Relationship Diagram](#entity-relationship-diagram)
3. [Public Schema — Business Tables](#public-schema--business-tables)
   - [companies](#1-companies)
   - [users](#2-users)
   - [customers](#3-customers)
   - [orders](#4-orders)
   - [order_assignments](#5-order_assignments)
   - [enquiries](#6-enquiries)
   - [order_messages](#7-order_messages)
   - [portal_access_tokens](#8-portal_access_tokens)
   - [order_files](#9-order_files)
   - [site_visits](#10-site_visits)
   - [site_visit_measurements](#11-site_visit_measurements)
   - [products](#12-products)
   - [quotations](#13-quotations)
   - [quotation_material_preferences](#14-quotation_material_preferences)
   - [audit_logs](#15-audit-logs)
   - [designs](#16-designs)
   - [payments](#17-payments)
4. [Auth Schema](#auth-schema)
5. [Storage & Realtime Schemas](#storage--realtime-schemas)
6. [Database Functions](#database-functions)
7. [Sequences](#sequences)
8. [Migrations](#migrations)
9. [Row Level Security](#row-level-security)
10. [Extensions](#extensions)
11. [Key Design Decisions](#key-design-decisions)

---

## Schema Overview

| Schema | Purpose | Table Count | Data Rows |
|--------|---------|-------------|-----------|
| `public` | Application business data | 15 | ~450+ |
| `auth` | Supabase Auth (users, sessions, MFA, OAuth, SSO) | 24 | ~130+ |
| `storage` | Supabase Storage (buckets, objects, multipart uploads) | 8 | System |
| `realtime` | Supabase Realtime (daily-partitioned messages, subscriptions) | 10 | Variable |
| `vault` | Encrypted secrets storage | 1 | 0 |
| `extensions` | Extension statistics (pg_stat_statements) | 2 | System |
| `supabase_migrations` | Migration tracking | 1 | 5+ |

---

## Entity Relationship Diagram

```
┌──────────────┐
│  companies   │
│  id (UUID)   │
└──────┬───────┘
       │
       ├─────────────────────────────────────────────────────────────────────────────────┐
       │                                                                                 │
       ▼                                                                                 ▼
┌──────────────┐                                                                  ┌──────────────┐
│    users     │                                                                  │  customers   │
│  id (UUID)   │                                                                  │  id (UUID)   │
│  company_id──┤                                                                  │  company_id──┤
│  role        │                                                                  │  customer_id │
│  staff_role  │                                                                  │  name        │
└──────┬───────┘                                                                  └──────┬───────┘
       │                                                                                 │
       │                                                                                 ├──────────────────────┐
       │                                                                                 │                      │
       ▼                                                                                 ▼                      ▼
┌──────────────────┐                                                              ┌──────────────┐      ┌──────────────┐
│  auth.users      │                                                              │    orders    │      │  enquiries   │
│  id (UUID) ──────┼──────────┐                                                   │  id (UUID)   │      │  id (UUID)   │
└──────────────────┘          │                                                   │  order_id ◄──┼──────┤  order_id    │
                              │                                                   │  customer_id─┤      │  customer_id─┤
                              │                                                   │  company_id──┤      │  enquire_id  │
                              │                                                   │  stage       │      │  status      │
                              │                                                   └──────┬───────┘      └──────────────┘
                              │                                                          │
                              │                                                          ├─────────────────────┐
                              │                                                          │                     │
                              ▼                                                          ▼                     ▼
                       ┌────────────────────────────┐                             ┌──────────────┐      ┌──────────────┐
                       │     order_assignments      │                             │ site_visits  │      │  quotations  │
                       │  id (UUID)                 │                             │  id (UUID)   │      │  id (UUID)   │
                       │  order_id ─────────────────┼─────────────────────────────┤  order_id────┤      │  order_id────┤
                       │  employee_id ──────────────┤                             │  company_id  │      │  customer_id │
                       └────────────────────────────┘                             └──────┬───────┘      └──────────────┘
                                                                                         │
                                                                                         ▼
                                                                                  ┌──────────────┐
                                                                                  │ measurements │
                                                                                  │  id (UUID)   │
                                                                                  │site_visit_id─┤
                                                                                  └──────────────┘
```

---

## Public Schema — Business Tables

### 1. companies
| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `uuid` | NO | `gen_random_uuid()` | Primary key |
| `name` | `text` | NO | — | Company display name |
| `created_at` | `timestamptz` | YES | `now()` | |

### 2. users
| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `uuid` | NO | — | Primary key (shared with auth.users) |
| `company_id` | `uuid` | YES | — | FK → `companies.id` |
| `name` | `text` | NO | — | Display name |
| `role` | `text` | NO | — | `admin` or `staff` |
| `phone` | `text` | NO | — | Contact phone |
| `email` | `text` | YES | — | Contact email |
| `staff_role` | `text` | YES | — | `Designer`, `Marketer`, etc |

### 3. customers
| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `uuid` | NO | `gen_random_uuid()` | Primary key |
| `company_id` | `uuid` | YES | — | FK → `companies.id` |
| `customer_id` | `text` | NO | `A001` auto-gen | UNIQUE |
| `name` | `text` | NO | — | Customer/company name |
| `phone` | `text` | NO | — | Primary phone |
| `whatsapp` | `text` | NO | — | WhatsApp number |
| `email` | `text` | NO | — | Email address |
| `city` | `text` | YES | — | |
| `billing_address` | `text` | YES | — | |
| `shipping_address` | `text` | YES | — | |
| `status` | `text` | YES | `'Active'` | |

### 4. orders
| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `uuid` | NO | `gen_random_uuid()` | Primary key |
| `order_id` | `text` | NO | — | UNIQUE. `{customer_id}-{NNN}` |
| `company_id` | `uuid` | YES | — | FK → `companies.id` |
| `customer_id` | `uuid` | NO | — | FK → `customers.id` |
| `project_name` | `text` | NO | — | |
| `stage` | `text` | NO | — | Pipeline stage |
| `health` | `text` | YES | `'Active'` | `Active` / `Lost` / `Completed` |
| `lost_reason` | `text` | YES | — | Reason if health = Lost |
| `stage_status` | `text` | YES | `'Normal'` | Stage health indicator |
| `dimensions` | `text` | YES | — | Overall dimensions notes |
| `notes` | `text` | YES | — | General notes |
| `stage_admin_notes` | `text` | YES | — | Admin-only notes per stage |
| `image_mockup` | `text` | YES | — | URL/path to mockup image |
| `budget` | `numeric` | YES | `0` | Budget amount |
| `deposit_paid` | `numeric` | YES | `0` | Deposit received |
| `date_created` | `timestamptz` | YES | `now()` | Order creation timestamp |

#### Assignment Arrays

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `assigned_employees` | `uuid[]` | `'{}'` | General assignees |
| `assigned_designers` | `uuid[]` | `'{}'` | Designer assignees |
| `assigned_marketers` | `uuid[]` | `'{}'` | Marketer assignees |

#### Stage locks

| Column | Type | Notes |
|--------|------|-------|
| `stage` | `text` | Pipeline phase (unchanged by payment gates) |
| `stage_status` | `text` | `"Normal"`, `"Pending Admin Approval: …"`, or **`"Pending Payment Verification"`** |

Design, production, installation, and payment data live in dedicated tables (`designs`, `productions`, `installations`, `payments`) — not JSONB columns on `orders`. Legacy `orders.design_details` was migrated and dropped.

#### Activity Tracking

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `version_history` | `jsonb` | `'[]'` | Stage progression log: `[{version, date, notes}]` |
| `chat_history` | `jsonb` | `'[]'` | Inline activity feed: `[{id, time, sender, message}]` |

#### Pipeline Stages (observed values)

```
Site Visit Pending → Site Visit Scheduled → Site Visit Completed
→ Quotation In Progress → Quotation Sent → Quotation Negotiation
→ Quotation Approved → Design In Progress
```

#### quote_details Structure

```jsonc
{
  "status": "Approved",   // optional
  "tax": 1176,
  "items": [{
    "id": "843610b3-...",
    "gstRate": 12,
    "quantity": 1,
    "totalSqFt": 98,
    "unitPrice": 9800,
    "costPerSqFt": 100,
    "description": "Acrylic sheet"
  }],
  "discount": 100,
  "subtotal": 9800,
  "grandTotal": 10876
}
```

#### version_history Structure

```jsonc
[
  {
    "version": "v4.0",
    "date": "17/6/2026",
    "notes": "Admin approved stage progression from \"Quotation Approved\" to \"Design In Progress\"."
  }
  // ... more entries, oldest first
]
```

#### chat_history Structure

```jsonc
[
  {
    "id": "1",                    // or "1781626079270" (timestamp), or "sys-1781688031390"
    "time": "Just now",           // or "02:50 pm", "11:15 AM"
    "sender": "System",           // or "Admin", staff name
    "message": "Order created successfully from Enquiry.",
    "verified": true              // optional, on portal links
  }
  // ... more entries
]
```

**Current Data (7 rows):**

| order_id | project_name | customer_name | stage | health |
|----------|-------------|---------------|-------|--------|
| `A010-001` | Sign board for ff21 | ff21 | Design In Progress | Active |
| `A011-001` | Sign board for Northstar LLP | Northstar LLP | Quotation Sent | Active |
| `A012-001` | New Project for Northstar LLP | Northstar LLP | Quotation Approved | Active |
| `A012-002` | New Project for hari | Northstar LLP | Site Visit Pending | Active |
| `A012-003` | ACP neon sign for Hari factories | Northstar LLP | Site Visit Pending | Active |
| `A013-001` | New Project for Prasad | Prasad | Site Visit Pending | Active |
| `A014-001` | New Project for sathya | sathya | Site Visit Pending | Active |

**Referenced by:** `enquiries.order_id`, `audit_logs.order_id` (UUID FK); `order_messages.order_id`, `order_files.order_id`, `portal_access_tokens.order_id` (TEXT, not FK)

**RLS Policies:**
- `Enable all access for authenticated users` — USING/WITH CHECK both `true` for authenticated
- `Enable update access for anon users` — USING/WITH CHECK both `true` for anonymous (⚠️ security concern)

**Trigger:** `generate_order_id_field()` — auto-generates `order_id` on insert

---

### 5. enquiries

Incoming leads. Created from contact forms, WhatsApp, phone calls. When converted, a Customer and Order are created and linked.

### 5. order_assignments
| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `uuid` | NO | `gen_random_uuid()` | Primary key |
| `order_id` | `uuid` | NO | — | FK → `orders.id` |
| `employee_id` | `uuid` | NO | — | FK → `users.id` |
| `assigned_at` | `timestamptz` | YES | `now()` | |

### 6. enquiries
| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `uuid` | NO | `gen_random_uuid()` | Primary key |
| `enquire_id` | `text` | NO | `ENQ001` auto-gen | UNIQUE |
| `company_id` | `uuid` | YES | — | FK → `companies.id` |
| `customer_id` | `uuid` | YES | — | FK → `customers.id` |
| `order_id` | `uuid` | YES | — | FK → `orders.id` |
| `lead_name` | `text` | NO | — | |
| `phone` | `text` | NO | — | |
| `whatsapp` | `text` | NO | — | |
| `email` | `text` | NO | — | |
| `source` | `text` | NO | — | |
| `status` | `text` | YES | `'Pending'` | |
| `date_received` | `timestamptz` | YES | `now()` | |

### 7. order_messages
| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `uuid` | NO | `gen_random_uuid()` | Primary key |
| `order_id` | `text` | NO | — | |
| `tab` | `text` | NO | — | `internal`, `customer`, `timeline` |
| `sender_name` | `text` | NO | — | |
| `sender_role` | `text` | NO | — | |
| `sender_id` | `uuid` | YES | — | FK → `auth.users.id` |
| `content` | `text` | NO | `''` | |
| `attachments` | `jsonb` | YES | `'[]'` | |
| `created_at` | `timestamptz` | YES | `now()` | |

### 8. portal_access_tokens
| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `uuid` | NO | `gen_random_uuid()` | Primary key |
| `jti` | `text` | NO | — | UNIQUE |
| `customer_id` | `text` | NO | — | e.g. `A012` |
| `order_id` | `text` | YES | — | e.g. `A012-001` |
| `expires_at` | `timestamptz` | NO | — | |
| `revoked_at` | `timestamptz` | YES | — | |

### 9. order_files
| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `uuid` | NO | `gen_random_uuid()` | Primary key |
| `order_id` | `text` | NO | — | |
| `category` | `text` | NO | — | |
| `file_name` | `text` | NO | — | |
| `file_path` | `text` | NO | — | |
| `created_at` | `timestamptz` | YES | `now()` | |

### 10. site_visits
| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `uuid` | NO | `gen_random_uuid()` | Primary key |
| `order_id` | `uuid` | YES | — | FK → `orders.id` |
| `company_id` | `uuid` | YES | — | FK → `companies.id` |
| `site_address` | `text` | YES | — | |
| `visit_date` | `text` | YES | — | |
| `visit_time` | `text` | YES | — | |
| `completed` | `boolean` | YES | `false` | |
| `photos` | `jsonb` | YES | null | |
| `notes` | `text` | YES | null | |
| `review_status` | `text` | YES | null | |

### 11. site_visit_measurements
| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `uuid` | NO | `gen_random_uuid()` | Primary key |
| `site_visit_id` | `uuid` | YES | — | FK → `site_visits.id` |
| `name` | `text` | NO | — | |
| `width` | `numeric` | YES | — | |
| `width_unit` | `text` | YES | `'ft'` | `ft` / `m` / `inch` |
| `height` | `numeric` | YES | — | |
| `height_unit` | `text` | YES | `'ft'` | |
| `depth` | `numeric` | YES | — | |
| `depth_unit` | `text` | YES | `'ft'` | |
| `ground_clearance` | `numeric` | YES | — | |
| `ground_clearance_unit` | `text` | YES | `'ft'` | |
| `photos` | `jsonb` | YES | — | |

### 12. products
| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `uuid` | NO | `gen_random_uuid()` | Primary key |
| `product_id` | `text` | NO | — | |
| `company_id` | `uuid` | YES | — | FK → `companies.id` |
| `name` | `text` | NO | — | |
| `pricing_type` | `text` | NO | `'per_unit'` | `per_unit` / `per_sqft` (running feet removed) |
| `price_per_sqft` | `numeric` | YES | — | |
| `price_per_unit` | `numeric` | YES | — | |

### 13. quotations
| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `uuid` | NO | `gen_random_uuid()` | Primary key |
| `quotation_id` | `text` | NO | — | |
| `order_id` | `uuid` | NO | — | FK → `orders.id` |
| `company_id` | `uuid` | YES | — | FK → `companies.id` |
| `customer_id` | `uuid` | YES | — | FK → `customers.id` |
| `status` | `text` | NO | `'Draft'` | |
| `items` | `jsonb` | NO | `'[]'` | |
| `grand_total` | `numeric` | NO | `0` | |
| `payment_status` | `text` | YES | `'Pending'` | |

### 14. quotation_material_preferences
| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `uuid` | NO | `gen_random_uuid()` | Primary key |
| `order_id` | `uuid` | YES | — | FK → `orders.id` |
| `signage_item_id` | `text` | NO | — | |
| `preferences` | `jsonb` | YES | `'{}'` | |

### 15. audit_logs
| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `uuid` | NO | `gen_random_uuid()` | Primary key |
| `company_id` | `uuid` | YES | — | FK → `companies.id` |
| `actor` | `text` | NO | — | |
| `action_type` | `text` | NO | — | |
| `order_id` | `uuid` | YES | — | FK → `orders.id` |
| `customer_id` | `uuid` | YES | — | FK → `customers.id` |
| `description` | `text` | NO | — | |
| `created_at` | `timestamptz` | YES | `now()` | |

### 16. designs
One row per order (extracted from legacy `orders.design_details`).

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `uuid` | NO | `gen_random_uuid()` | Primary key |
| `order_id` | `uuid` | NO | — | FK → `orders.id`, UNIQUE |
| `resources` | `jsonb` | NO | `'[]'` | Inspiration / logos |
| `items` | `jsonb` | NO | `'[]'` | Proofs, versions, comments, production files |
| `payment_verified` | `boolean` | NO | `false` | Legacy checklist; gates use `payments` |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | Trigger-maintained |

### 17. payments
Payment milestones (business gates — not a pipeline stage).

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `uuid` | NO | `gen_random_uuid()` | Primary key |
| `order_id` | `uuid` | NO | — | FK → `orders.id` ON DELETE CASCADE |
| `payment_name` | `text` | NO | — | |
| `trigger_stage` | `text` | NO | — | Stage when gate was created |
| `amount_type` | `text` | NO | — | `fixed` / `percentage` |
| `amount` | `numeric` | YES | — | Fixed amount |
| `percentage` | `numeric` | YES | — | % of quotation `grand_total` |
| `calculated_amount` | `numeric` | YES | — | Resolved amount |
| `required_for_next_stage` | `boolean` | NO | `true` | |
| `status` | `text` | NO | `'pending'` | `pending` / `requested` / `paid` / `verified` / `waived` |
| `payment_method` | `text` | YES | — | `manual` today; future gateways |
| `payment_reference` | `text` | YES | — | UTR / gateway id |
| `notes` | `text` | YES | — | |
| `requested_at` | `timestamptz` | YES | — | |
| `paid_at` | `timestamptz` | YES | — | |
| `verified_at` | `timestamptz` | YES | — | |
| `verified_by` | `uuid` | YES | — | |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | |

Indexes: `order_id`, `status`, `trigger_stage`.

When a required payment is created, `orders.stage_status` becomes `Pending Payment Verification` (stage unchanged).

### 18. productions / installations
Dedicated tables for workshop and field work (extracted from legacy order JSONB). See application code for full column lists.

---

## Auth Schema

Supabase's built-in authentication schema. 24 tables managing users, sessions, identities, MFA, OAuth, SSO, and WebAuthn.

---

## Storage & Realtime Schemas

### Storage
Standard Supabase Storage schema for file/bucket management.

### Realtime
Supabase Realtime with daily-partitioned message tables.

---

## Database Functions

### generate_order_id_field()
Trigger function that runs `BEFORE INSERT` on `orders` to auto-generate the human-friendly `order_id`.

---

## Sequences

| Sequence | Schema | Purpose | Current Range |
|----------|--------|---------|---------------|
| `customer_code_seq` | `public` | Auto-generates `customer_id` (`A###`) | Variable |
| `enquiry_code_seq` | `public` | Auto-generates `enquire_id` (`ENQ###`) | Variable |

---

## Row Level Security

All public tables have RLS enabled. Most have policies that allow authenticated users full access. There are some specific anonymous access policies for `orders` and `order_files` which should be audited for security.

---

## Extensions

| Extension | Schema | Purpose |
|-----------|--------|---------|
| `pgcrypto` | `extensions` | Cryptographic functions |
| `uuid-ossp` | `extensions` | UUID generation |

---

## Key Design Decisions

### 1. Hybrid JSONB + Relational Model
The schema makes extensive use of JSONB for arrays or stage-specific details (e.g. `items` in `quotations`, `photos` in `site_visits`, `chat_history` in `orders`). This avoids excessive junction tables but limits deep querying.

### 2. Extracted Relational Tables
Recently, several models were extracted from pure JSONB to true relational tables:
- `site_visits` and `site_visit_measurements`
- `quotations` and `products`
- `order_assignments`

### 3. UUID + Human-Friendly IDs
All primary keys are UUIDs, but user-facing IDs use auto-generated friendly codes (`A001`, `ENQ001`, `A001-001`).

### 4. Portal Token Architecture
Customer portal access uses JWT tokens stored in `portal_access_tokens`.