# WMS Implementation Plan

## 1. Document Review
The uploaded PDF is a strong product blueprint, but it is not yet a complete SRS. It clearly lists features, entities, API groups, metrics, and market direction. The main gap is execution detail: user roles, screen flows, warehouse workflows, acceptance criteria, integration contracts, offline/mobile behavior, security rules, and non-functional requirements are still too open.

Conclusion: treat this as a product scope draft, not build-ready requirements.

## 2. Recommended Architecture
- `Next.js`: admin dashboard, warehouse operations UI, scanning workflows, reporting, authentication-aware pages
- `Node.js`: domain API, workflow orchestration, integrations, webhooks, background jobs
- `PostgreSQL`: system of record for inventory, orders, movements, shipments, returns, and audit logs
- `Supabase`: managed PostgreSQL, Auth, Storage, Realtime, database functions, and Row Level Security where useful

Recommended split:
- `apps/web`: Next.js frontend
- `apps/api`: Node.js backend
- `packages/db`: schema, migrations, seeds
- `packages/shared`: types, validators, constants

## 3. MVP Scope
Build only the core single-warehouse MVP first:
- inventory management
- products, bins, zones, and locations
- receiving and put-away
- order processing
- picking, packing, shipping
- barcode scanning via mobile web/PWA
- returns processing
- user roles and audit trail
- dashboard KPIs
- Shopify + WooCommerce integrations

Defer for later phases:
- AI forecasting
- robot/IoT integrations
- AR/VR
- blockchain
- warehouse layout designer
- multi-warehouse optimization

## 4. Core Data Model
Start with these tables:
- `users`, `roles`, `warehouses`
- `products`, `lots`, `serial_numbers`
- `zones`, `locations`, `bins`
- `inventory`, `inventory_movements`, `adjustments`, `cycle_counts`
- `orders`, `order_items`, `shipments`, `carriers`
- `receipts`, `putaway_tasks`, `pick_tasks`, `pack_tasks`
- `returns`, `return_items`
- `integrations`, `webhook_events`, `audit_logs`

## 5. Delivery Plan
### Phase 0: Requirements Lock
- define actor matrix: admin, manager, picker, receiver, packer
- write user stories and acceptance criteria for inbound, outbound, returns, and counting
- confirm integration priority and barcode device assumptions

### Phase 1: Platform Setup
- initialize monorepo
- configure Supabase project, auth, storage, migrations
- set up Next.js app, Node.js API, shared types, CI, linting, testing

### Phase 2: Inventory + Inbound
- product catalog
- warehouse layout entities
- receiving, put-away, stock movement, audit logs

### Phase 3: Orders + Outbound
- order import
- allocation
- picking waves
- packing, shipping labels, shipment tracking

### Phase 4: Mobile Operations
- PWA scanning flows
- camera/barcode integration
- task-based operator UI

### Phase 5: Returns + Reporting
- returns workflow
- KPI dashboards
- cycle counts and variance reporting

### Phase 6: Hardening
- permissions review
- rate limits
- monitoring
- load testing
- backup and recovery checks

## 6. Immediate Next Actions
1. Convert the blueprint into a real SRS with workflow-level acceptance criteria.
2. Finalize the MVP schema and API contracts.
3. Bootstrap the monorepo and Supabase project.
4. Build inventory and receiving before order fulfillment.
