# Multi-Agent Operating Model

## When To Enable Fast Mode
Turn on multi-agent execution only after these are locked:
- `SRS.md` for MVP workflows
- schema v1
- API contracts
- repo structure and build commands

## Recommended Agent Split
- `Lead Agent`: owns sequencing, contract changes, and final integration
- `DB/API Agent`: schema, migrations, routes, audit logging
- `Frontend/PWA Agent`: dashboard, task flows, mobile scanning UX
- `Integration Agent`: Shopify, WooCommerce, webhook replay handling
- `QA Agent`: regression matrix and release checks

## Handoff Rules
- Shared DTOs and enums live in `packages/shared`.
- Schema changes happen before frontend or integration assumptions change.
- Frontend never depends on direct table shapes.
- Integration payload changes require contract updates and test coverage.
- The lead agent resolves conflicts on status models, permissions, and workflow semantics.

