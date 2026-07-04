# Design Feature Specification

## Overview

* Purpose of the feature: Manage the design process between the design team and the customer, track design iterations, approvals, and finalize production-ready files.
* Business objective: Ensure all designs are approved by the customer before production, maintain a clear history of changes and feedback, and securely transfer final design files to the production team.
* User roles involved: Customer, Admin, Designer, Production Manager

## Workflow

1. **Inspiration Collection**: Customer or Admin uploads brand assets, logos, and reference designs (Inspiration & Logos).
2. **Drafting Phase**: Designer reviews requirements and uploads initial design proofs (images) for each item.
3. **Review Phase**: Admin reviews and sends the design to the customer.
4. **Customer Feedback**: Customer views the design and can place pin-point comments directly on the image. They can either request changes or approve the design.
5. **Iteration**: Designer uploads new versions based on customer feedback.
6. **Approval**: Customer approves the design proof.
7. **Production Handoff**: Designer or Admin uploads final production-ready files (e.g., CDR, DXF, PNG, JPG) linked to the approved item.
8. **Next Stage**: Order transitions to the Production stage.

## Workflow States

| State | Description | Next Allowed States |
| ----- | ----------- | ------------------- |
| Draft | Initial design uploaded by Designer, pending internal review | Sent to Customer, Pending Admin |
| Pending Admin | Waiting for admin approval before sending to customer | Sent to Customer, Draft |
| Sent to Customer | Customer is currently reviewing the design | Changes Requested, Approved |
| Changes Requested | Customer has requested modifications via comments | Draft (new version) |
| Approved | Customer has signed off on the design | N/A (End of iteration for this item) |

## Business Rules

* Customer must approve the design for all items before the order can transition to production.
* Customers can upload Inspiration & Logos using specific formats: `.png, .pdf, .jpg, .jpeg, .cdr, .ai, .psd, .svg`.
* Designers can upload multiple iterations (versions) for each item.
* Comments are tied to specific coordinates (X, Y) on a specific design version.
* Final production files must be in valid fabrication/image formats: `.cdr, .dxf, .plt, .pdf, .svg, .png, .jpg`.
* A design cannot be approved if it is still in Draft status.

## User Roles

### Customer

Permissions:
* Upload Inspiration & Logos.
* View design versions sent to them.
* Add pinpoint comments and general comments on designs.
* Approve designs or request changes.

### Admin

Permissions:
* All Customer permissions.
* Approve internal drafts and transition them to "Sent to Customer".
* Upload and delete final production files.
* Move the order stage to Production once designs are approved.

### Designer

Permissions:
* View Inspiration & Logos.
* Upload new design versions for items.
* View customer comments.
* Upload final production files.

### Production Manager

Permissions:
* View approved designs.
* Download final production files for fabrication.

## Database Design

### Tables

#### designs (dedicated table, one row per order)

Design data was extracted from the legacy `orders.design_details` JSONB column into `public.designs`. Frontend reads `order.design` (`DesignRecord`).

| Column | Type | Notes |
| ------ | ---- | ----- |
| `id` | uuid PK | `gen_random_uuid()` |
| `order_id` | uuid FK → `orders.id` | Unique, ON DELETE CASCADE |
| `resources` | jsonb | Inspiration / logo uploads |
| `items` | jsonb | Multi-item proofs, versions, comments, production files |
| `created_at` / `updated_at` | timestamptz | `updated_at` via trigger |

`items` / `resources` JSONB shape (unchanged from legacy):

```json
{
  "resources": [
    {
      "id": "uuid",
      "url": "string",
      "name": "string",
      "type": "link | file",
      "uploadedBy": "Customer | Staff",
      "createdAt": "timestamp"
    }
  ],
  "items": [
    {
      "id": "uuid",
      "name": "string",
      "currentVersion": "number",
      "versions": [
        {
          "id": "uuid",
          "versionNumber": "number",
          "proofUrl": "string",
          "fileName": "string",
          "status": "Draft | Pending Admin | Sent to Customer | Changes Requested | Approved",
          "createdAt": "timestamp",
          "comments": [
            {
              "id": "uuid",
              "x": "number",
              "y": "number",
              "content": "string",
              "author": "string",
              "createdAt": "timestamp"
            }
          ]
        }
      ],
      "productionFiles": [
        {
          "id": "uuid",
          "name": "string",
          "url": "string",
          "createdAt": "timestamp"
        }
      ]
    }
  ]
}
```

*Note: `mapDesignFromDb` still accepts legacy top-level `versions` / `currentVersion` and exposes them as a single "General Design" item. New orders auto-insert an empty `designs` row on create.*

Server actions: `src/features/designs/actions/designActions.ts`, mapper: `designMapper.ts`.

#### storage buckets

* `site-visit-photos` - Used for storing design proofs, logos, and production files under the path structure: `{order_id}/designs/{filename}` or `{order_id}/production/{filename}`.

## API Endpoints

### Update Design Details

Method: Server Action
Route: `updateDesignDetailsAction(orderId, details)` in `src/features/designs/actions/designActions.ts`

Request:
```json
{
  "orderId": "uuid",
  "details": {
    "items": "Partial<DesignItem>[]",
    "resources": "Partial<DesignResource>[]"
  }
}
```

Validation Rules:
* User must be authenticated.
* Payload maps to `Partial<DesignRecord>` (`resources`, `items`).
* Writes to `designs` via UPSERT on `order_id`.

### Upload File

Method: Supabase Storage API
Bucket: `site-visit-photos`
Path: `{orderId}/designs/{timestamp}-{random}.ext` or `{orderId}/production/{timestamp}-{random}.ext`

Validation Rules:
* File size limits defined by Supabase storage bucket policies.
* Content types restricted in the UI to the accepted formats.

## UI Components

### DesignModule (Staff Facing)

Purpose: Interface for Admins and Designers to manage design items, upload proofs, rotate images, view feedback, and upload production files.
Fields:
* Item selector tabs
* Proof upload zone
* Pinpoint commenting canvas
* Production files upload zone (Accepts: `.cdr, .dxf, .plt, .pdf, .svg`)

### DesignTab (Customer Facing)

Purpose: Interface for the Customer in the Portal to view designs, add comments, upload inspiration, and approve proofs.
Fields:
* Inspiration & Logos upload zone (Accepts: `.png, .pdf, .jpg, .jpeg, .cdr, .ai, .psd, .svg`)
* Feedback canvas (pinpoint coordinates)
* Action buttons: "Request Changes", "Approve Design"

## File Structure

* `src/features/order-detail/components/design/DesignModule.tsx`
* `src/app/portal/components/DesignTab.tsx`
* `src/types/index.ts`

## Data Flow

UI (DesignModule/DesignTab)
→ File uploaded directly to Supabase Storage bucket
→ File URL generated
→ DesignDetails JSON constructed in React state
→ `updateDesignDetails` action called
→ Database `orders` table updated

## Error Handling

Possible errors:
* **Upload Failure**: File too large or unsupported format.
* **Update Failure**: Concurrent modification or network error during `updateDesignDetails`.

Expected behavior:
* Graceful fallback with clear JavaScript `alert()` or toast messages.
* Immediate rollback of UI state if the database update fails.

## Notifications

* In-app timeline updates (e.g., "Client approved the design proof layout.") added to `order_activity` table.
* Potential future email/WhatsApp notifications on "Sent to Customer" status.

## Security Rules

* Customers can only view and interact with their own orders via secure portal links.
* Only Staff (Admin/Designer) can transition status from "Draft" and upload final production files.
* Row Level Security (RLS) on `designs` (authenticated full access) and storage buckets ensure data isolation.

## Edge Cases

* **Image Rotation**: If an image is rotated using the UI tools, an HTML canvas draws the rotated image and a new Blob is generated and uploaded instead of the original file.
* **Legacy Orders**: Multi-item vs Single-item support exists. Older orders might lack the `items` array. The UI falls back to a "General Design" item mapping to the top-level `versions` array.
* **File Deletion**: If a production file is deleted, the storage object is removed alongside the JSONB array update.

## Future Enhancements

* Email/WhatsApp notifications when a design needs customer review.
* Version comparison (side-by-side diffing of design versions).
* Watermarking design proofs to prevent unauthorized use before payment.
* Auto-convert legacy single-item designs to the new multi-item structure in the database.

## Change Log

Version: 1.0
Date: 2026-07-03
Summary: Initial specification for the Design Workflow.

Version: 1.1
Date: 2026-07-04
Summary: Design data moved from `orders.design_details` to dedicated `designs` table; frontend uses `order.design` / `designActions.ts`.
