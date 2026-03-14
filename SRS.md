# Software Requirements Specification

## 1. Purpose
This document defines the build-ready requirements for the AIMaha Kruksetra warehouse management system (WMS). The platform is an omnichannel, web-first WMS for e-commerce and distribution operations with a single-warehouse MVP and a phased path to broader warehouse automation.

The implementation stack is fixed:
- `Next.js` for admin and operator UI
- `Node.js` for API, orchestration, jobs, and integrations
- `PostgreSQL` as the source of truth
- `Supabase` for Postgres hosting, Auth, Storage, Realtime, and Row Level Security

## 2. Product Goals
- Centralize inventory, order, and fulfillment workflows for one warehouse in MVP.
- Reduce picking and receiving errors through barcode-first task flows.
- Sync orders and fulfillment state with `Shopify` and `WooCommerce`.
- Expose auditable operational data for managers and admins.
- Preserve a clean path to multi-warehouse, automation, and AI-driven optimization after MVP.

## 3. Release Boundaries
### 3.1 MVP
- Single warehouse
- User roles and permission-controlled task execution
- Product catalog, warehouse zones, locations, and bins
- Inventory tracking and inventory movement audit
- Receiving and put-away
- Order import and order lifecycle tracking
- Picking, packing, and shipping confirmation
- Returns intake and restocking/disposition
- Cycle counts and variance reporting
- KPI dashboard
- `Shopify` and `WooCommerce` integrations
- Web + PWA operator experience with barcode scanning

### 3.2 Deferred
- Multi-warehouse optimization
- Direct carrier label purchase
- Lot/serial-heavy regulated workflows
- AI forecasting and slotting
- Robotics, IoT, AR/VR, blockchain, and digital twin capabilities

## 4. Users And Roles
- `Admin`: manages system configuration, integrations, users, and permissions
- `Manager`: monitors KPIs, inventory health, exceptions, and operational throughput
- `Receiver`: processes inbound receipts and put-away
- `Picker`: executes pick tasks and handles pick exceptions
- `Packer`: packs shipments, confirms dispatch, and records carrier/tracking details

## 5. Operating Assumptions
- MVP supports one legal company and one active warehouse.
- Inventory mutations require a live network connection. The PWA may cache screens and draft scans, but stock is not committed offline.
- Supabase Auth is the identity provider. Application roles are stored in application tables and enforced by the API plus database policies.
- Shipping in MVP supports shipment creation, tracking capture, and commerce-channel status sync. Direct carrier API purchase is optional and not required for launch.

## 6. Functional Requirements
### 6.1 Authentication And Access Control
- `FR-AUTH-01`: Users must authenticate through Supabase Auth.
- `FR-AUTH-02`: Every user must be assigned exactly one active application role.
- `FR-AUTH-03`: Unauthorized users must not view warehouse data.
- `FR-AUTH-04`: Role permissions must apply to page access, API access, and task actions.

Acceptance criteria:
- An unauthenticated request to any protected page redirects to sign-in.
- A `picker` cannot access user administration or integration settings.
- Every protected API request resolves the current user and role before domain logic runs.

### 6.2 Master Data
- `FR-MASTER-01`: Admins and managers must manage products with SKU, barcode, name, status, unit of measure, and dimensions.
- `FR-MASTER-02`: Admins and managers must define zones, locations, and bins for the warehouse.
- `FR-MASTER-03`: Products may be active, inactive, or blocked for picking.

Acceptance criteria:
- A product cannot be received or picked if it is inactive or blocked.
- A bin must belong to exactly one location and one warehouse.

### 6.3 Inventory
- `FR-INV-01`: The system must track on-hand, allocated, available, and damaged quantities per product and bin.
- `FR-INV-02`: Every inventory change must create an immutable movement record.
- `FR-INV-03`: Inventory adjustments require a reason code and user attribution.
- `FR-INV-04`: Managers must view current stock, low-stock indicators, and recent movement history.

Acceptance criteria:
- Available quantity equals on-hand minus allocated.
- An inventory adjustment without a reason code is rejected.
- Movement history includes timestamp, user, source state, target state, quantity, and reference document.

### 6.4 Receiving And Put-Away
- `FR-REC-01`: Receivers must create or import inbound receipts.
- `FR-REC-02`: Receivers must scan product and bin/location codes during receiving and put-away.
- `FR-REC-03`: Receiving must support full, partial, and exception outcomes.
- `FR-REC-04`: Put-away tasks must move received stock from staging to storage bins.

Receiving workflow:
1. Receiver opens an expected or ad hoc receipt.
2. Receiver scans product barcode and enters or confirms quantity.
3. System validates product, status, and target warehouse.
4. System creates received inventory in a staging bin and logs a movement.
5. System creates put-away tasks for staged inventory.

Acceptance criteria:
- A scan for an unknown barcode shows a blocking error.
- Partial receipt keeps the receipt open with remaining expected quantity visible.
- Completing put-away moves inventory from staging to the destination bin and closes the task.

### 6.5 Orders And Allocation
- `FR-ORD-01`: The system must import orders from `Shopify` and `WooCommerce`.
- `FR-ORD-02`: Orders must validate SKU availability before allocation.
- `FR-ORD-03`: Orders may be `new`, `allocated`, `picking`, `packed`, `shipped`, `cancelled`, or `exception`.
- `FR-ORD-04`: Allocation reserves stock and reduces available quantity without changing on-hand quantity.

Acceptance criteria:
- An order containing an unknown SKU enters `exception`.
- Allocation failure leaves the order in `exception` or `new` based on validation outcome.
- Re-running an integration event for the same order must not create duplicates.

### 6.6 Picking
- `FR-PICK-01`: Managers may release pick tasks from allocated orders.
- `FR-PICK-02`: Pickers must confirm product and bin scans before task completion.
- `FR-PICK-03`: The system must record short pick, wrong-item, and missing-bin exceptions.
- `FR-PICK-04`: A completed pick task updates reserved inventory state and task history.

Acceptance criteria:
- A picker cannot complete a task without scanning the expected SKU or an approved override.
- A short pick raises an exception visible to the manager dashboard.

### 6.7 Packing And Shipping
- `FR-SHIP-01`: Packers must confirm picked items before packing.
- `FR-SHIP-02`: The system must create a shipment record per packed order.
- `FR-SHIP-03`: Packers must record carrier, service level, package count, and tracking number.
- `FR-SHIP-04`: Shipment confirmation must update the originating commerce channel when configured.

Acceptance criteria:
- An order cannot be marked shipped unless it has at least one packed item and a tracking reference.
- A failed outbound status sync must be retried and surfaced as an integration exception.

### 6.8 Returns
- `FR-RET-01`: Users with receiver or manager permissions must register returns against an order.
- `FR-RET-02`: Return items must be classified as restock, quarantine, or damage.
- `FR-RET-03`: Restocked items must create inventory movements back into an approved bin.

Acceptance criteria:
- Returned items without a source order reference are allowed only for manager users with a manual reason.
- Damage disposition must not increase available inventory.

### 6.9 Cycle Counting
- `FR-COUNT-01`: Managers must create cycle count schedules by product, bin, or zone.
- `FR-COUNT-02`: Count tasks must compare expected and counted quantities.
- `FR-COUNT-03`: Variances require review and approval before inventory is adjusted.

Acceptance criteria:
- Count approval creates an adjustment movement and an audit record.
- Rejected count submissions remain visible for recount.

### 6.10 Dashboards And Reporting
- `FR-RPT-01`: Managers and admins must see KPIs for order accuracy, fulfillment time, inventory variance, open exceptions, and receiving throughput.
- `FR-RPT-02`: Dashboards must support filtering by date range and workflow type.
- `FR-RPT-03`: Reports must be exportable as CSV.

### 6.11 Audit Trail
- `FR-AUD-01`: The platform must record immutable audit logs for authentication-sensitive actions, master data changes, inventory changes, task completions, and integration events.
- `FR-AUD-02`: Audit entries must include actor, action, entity type, entity id, timestamp, and payload summary.

### 6.12 Integrations
- `FR-INT-01`: `Shopify` and `WooCommerce` must support inbound product and order synchronization.
- `FR-INT-02`: Commerce order updates must be replay-safe and idempotent.
- `FR-INT-03`: Fulfillment updates must push tracking and shipment state back to the source channel.
- `FR-INT-04`: Integration failures must be persisted with retry status and error details.

Acceptance criteria:
- Duplicate webhook deliveries do not create duplicate orders or duplicate status transitions.
- A disabled integration cannot process new inbound events.

### 6.13 Notifications
- `FR-NOTIFY-01`: The system must surface in-app notifications for allocation failures, short picks, sync failures, and count variances.
- `FR-NOTIFY-02`: Managers must be able to resolve or acknowledge operational exceptions.

## 7. Barcode And PWA Requirements
- `FR-PWA-01`: The operator experience must be optimized for mobile browsers.
- `FR-PWA-02`: The application must expose a web app manifest and service worker for installability.
- `FR-PWA-03`: Supported scan inputs must include camera scanning and keyboard-emulating barcode scanners.
- `FR-PWA-04`: The application must support `Code 128`, `Code 39`, `EAN-13`, `UPC-A`, and `QR` input formats.
- `FR-PWA-05`: When connectivity drops, the UI must preserve the current task context and visibly block final inventory mutation until reconnection succeeds.

## 8. Data Model Overview
Core entities:
- `warehouses`
- `roles`
- `users`
- `products`
- `zones`
- `locations`
- `bins`
- `inventory`
- `inventory_movements`
- `orders`
- `order_items`
- `tasks`
- `shipments`
- `returns`
- `integrations`
- `audit_logs`

Key state models:
- Order: `new`, `allocated`, `picking`, `packed`, `shipped`, `cancelled`, `exception`
- Task: `open`, `in_progress`, `blocked`, `completed`, `cancelled`
- Shipment: `draft`, `packed`, `dispatched`, `failed`
- Return: `initiated`, `received`, `restocked`, `disposed`

## 9. API Surface
Required route groups:
- `/auth`
- `/users`
- `/warehouses`
- `/products`
- `/inventory`
- `/orders`
- `/tasks`
- `/shipments`
- `/returns`
- `/reports`
- `/integrations`
- `/analytics`
- `/notifications`

API rules:
- Every write endpoint must validate payloads with shared schemas.
- Every write endpoint must resolve the authenticated user and role.
- Inventory-affecting endpoints must be transactional.
- Integration webhooks must accept duplicate deliveries without duplicate side effects.

## 10. Non-Functional Requirements
### 10.1 Performance
- Read APIs: `p95 < 500ms` for standard dashboard and list queries under normal load.
- Write APIs: `p95 < 1200ms` for receiving, picking, packing, and return submissions.
- Barcode confirmation round-trip: target `p95 < 1500ms` on a stable warehouse Wi-Fi network.

### 10.2 Availability And Recovery
- Monthly application availability target: `99.5%`.
- Database backups must run daily.
- Recovery objective target: `RPO <= 24h`, `RTO <= 4h`.

### 10.3 Security
- All secrets must be stored outside source control.
- Role checks must be enforced server-side.
- Sensitive administrative actions must be audit logged.
- The API must rate-limit authentication and webhook endpoints.

### 10.4 Observability
- API errors, webhook retries, and background job failures must be logged with correlation ids.
- Managers must see integration failure counts and open warehouse exceptions.

### 10.5 Data Integrity
- Inventory state changes must occur inside database transactions.
- Orders, tasks, and shipments must use explicit status transitions only.
- Hard deletes are not allowed for operational records after creation.

## 11. Acceptance Test Scenarios
### 11.1 Receive Stock
- Given an active product and valid receipt
- When the receiver scans the product and confirms quantity
- Then staging inventory increases, a movement is recorded, and a put-away task is created

### 11.2 Put Away Stock
- Given staged inventory and an open put-away task
- When the receiver scans the destination bin and completes the task
- Then the system moves stock to the target bin and marks the task completed

### 11.3 Import And Allocate Order
- Given a valid inbound order from Shopify or WooCommerce
- When the integration processes the webhook
- Then the system creates or updates the order once and reserves available stock

### 11.4 Pick Order
- Given an allocated order
- When a picker scans the assigned bin and SKU
- Then the task completes only if the scan matches the expected item and quantity rules

### 11.5 Pack And Ship
- Given completed pick tasks
- When the packer confirms items, carrier, and tracking
- Then the shipment is created, the order becomes shipped, and the source channel is updated

### 11.6 Process Return
- Given a shipped order
- When a receiver records a return and selects restock
- Then inventory increases in the destination bin and an audit record is created

### 11.7 Count Variance
- Given a cycle count task with a mismatch
- When a manager approves the variance
- Then the system creates an adjustment movement and stores the approval trail

## 12. Future Vision
After MVP stabilization, the platform may extend into:
- multi-warehouse orchestration
- labor management
- advanced wave planning
- direct carrier APIs
- demand forecasting
- slotting optimization
- autonomous device and robot integration

These capabilities are explicitly outside the first implementation baseline unless a later change request elevates them.
